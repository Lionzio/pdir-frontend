import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';


export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  isStreaming: boolean;
  toolCalls?: { name: string; status: 'running' | 'completed' | 'error' }[];
}

@Injectable({
  providedIn: 'root',
})
export class CopilotService {
  public messages = signal<ChatMessage[]>([]);
  public isTyping = signal<boolean>(false);
  public isVisible = signal<boolean>(false);
  private sessionId = crypto.randomUUID();

  constructor(private http: HttpClient) {}

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
      const token = localStorage.getItem('access_token');
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

      if (!response.body) throw new Error('No readable stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        isStreaming: true,
        toolCalls: [],
      };

      this.messages.update((m) => [...m, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.event === 'text_delta') {
                assistantMsg.content += data.data;
              } else if (data.event === 'tool_start') {
                assistantMsg.toolCalls?.push({ name: data.name, status: 'running' });
              } else if (data.event === 'tool_end') {
                const tc = assistantMsg.toolCalls?.find(
                  (t) => t.name === data.name && t.status === 'running',
                );
                if (tc) tc.status = 'completed';
              } else if (data.event === 'error') {
                assistantMsg.content += `\\n[Erro: ${data.data}]`;
              } else if (data.event === 'message_complete') {
                assistantMsg.isStreaming = false;
              }

              // Force trigger update for signals
              this.messages.update((m) => {
                const newArr = [...m];
                const idx = newArr.findIndex((x) => x.id === assistantMsg.id);
                if (idx >= 0) newArr[idx] = { ...assistantMsg };
                return newArr;
              });
            } catch (e) {
              // Ignore malformed JSON chunks from splits
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE Error:', error);
      this.messages.update((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: 'Ocorreu um erro de conexão com o Assistente.',
          isStreaming: false,
        },
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
