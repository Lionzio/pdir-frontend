import { Injectable, signal, inject } from '@angular/core';
import { AuthStorageService } from '../../../core/services/auth-storage.service';
import { CopilotEvent, SseParser } from './sse-parser';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  isStreaming: boolean;
  toolCalls?: { name: string; status: 'running' | 'completed' | 'error' }[];
}

/** Mensagem exibida para cada falha HTTP do chat (o detalhe técnico não vai para a tela). */
export function chatErrorMessage(status: number): string {
  if (status === 401 || status === 403)
    return 'Sua sessão expirou. Entre novamente para usar o Assistente.';
  if (status === 422) return 'Mensagem inválida ou longa demais (máximo de 2000 caracteres).';
  if (status === 429)
    return 'Muitas mensagens em pouco tempo. Aguarde um instante e tente de novo.';
  return 'O Assistente está indisponível no momento. Tente novamente em instantes.';
}

export class ChatHttpError extends Error {
  constructor(readonly status: number) {
    super(chatErrorMessage(status));
  }
}

@Injectable({
  providedIn: 'root',
})
export class CopilotService {
  public messages = signal<ChatMessage[]>([]);
  public isTyping = signal<boolean>(false);
  public isVisible = signal<boolean>(false);
  private sessionId = crypto.randomUUID();
  private authStorage = inject(AuthStorageService);

  toggleVisibility() {
    this.isVisible.update((v) => !v);
  }

  async sendMessage(text: string) {
    if (!text.trim()) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      isStreaming: false,
    };

    this.messages.update((m) => [...m, userMsg]);
    this.isTyping.set(true);

    try {
      const session = this.authStorage.getSession();
      const token = session?.token || '';
      const response = await fetch('/api/v1/intelligence/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          message: text,
        }),
      });

      // Status HTTP de erro não tem stream de eventos: falha com mensagem tratável (T-31)
      if (!response.ok) throw new ChatHttpError(response.status);
      if (!response.body) throw new Error('No readable stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        isStreaming: true,
        toolCalls: [],
      };

      this.messages.update((m) => [...m, assistantMsg]);

      const apply = (events: CopilotEvent[]) => {
        for (const data of events) {
          if (data.event === 'text_delta') {
            assistantMsg.content += data.data ?? '';
          } else if (data.event === 'tool_start' && data.name) {
            assistantMsg.toolCalls?.push({ name: data.name, status: 'running' });
          } else if (data.event === 'tool_end') {
            const tc = assistantMsg.toolCalls?.find(
              (t) => t.name === data.name && t.status === 'running',
            );
            if (tc) tc.status = 'completed';
          } else if (data.event === 'error') {
            assistantMsg.content += `\n[Erro: ${data.data ?? 'falha no Assistente'}]`;
          } else if (data.event === 'message_complete') {
            assistantMsg.isStreaming = false;
          }
        }
        if (events.length > 0) {
          // Nova referência para o signal notificar a view
          this.messages.update((m) =>
            m.map((x) => (x.id === assistantMsg.id ? { ...assistantMsg } : x)),
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        apply(parser.push(decoder.decode(value, { stream: true })));
      }
      apply(parser.push(decoder.decode()));
      apply(parser.flush());
    } catch (error) {
      const content =
        error instanceof ChatHttpError
          ? error.message
          : 'Ocorreu um erro de conexão com o Assistente.';
      this.messages.update((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'system', content, isStreaming: false },
      ]);
    } finally {
      this.isTyping.set(false);
      this.messages.update((m) => {
        const arr = [...m];
        if (arr.length > 0) arr[arr.length - 1].isStreaming = false;
        return arr;
      });
    }
  }
}
