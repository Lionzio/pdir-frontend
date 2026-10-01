import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { CopilotService } from './copilot.service';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

const frame = (payload: object) => `data: ${JSON.stringify(payload)}\n\n`;

describe('CopilotService (T-31)', () => {
  let service: CopilotService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    service = TestBed.inject(CopilotService);
  });

  it('renderiza os 3 eventos de um único chunk', async () => {
    const body =
      frame({ event: 'text_delta', data: 'Quartos ' }) +
      frame({ event: 'text_delta', data: 'livres: 101' }) +
      frame({ event: 'message_complete' });
    spyOn(window, 'fetch').and.resolveTo(new Response(streamOf(body), { status: 200 }));

    await service.sendMessage('Há quartos livres?');

    const assistant = service.messages().find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('Quartos livres: 101');
    expect(assistant?.isStreaming).toBeFalse();
  });

  it('junta um evento partido entre chunks', async () => {
    const full = frame({ event: 'text_delta', data: 'inteiro' });
    spyOn(window, 'fetch').and.resolveTo(
      new Response(streamOf(full.slice(0, 10), full.slice(10)), { status: 200 }),
    );

    await service.sendMessage('teste');

    expect(service.messages().find((m) => m.role === 'assistant')?.content).toBe('inteiro');
  });

  it('resposta 500 vira mensagem de erro sem travar o input', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('Internal Server Error', { status: 500 }));

    await service.sendMessage('olá');

    const last = service.messages()[service.messages().length - 1];
    expect(last.role).toBe('system');
    expect(last.content).toContain('indisponível');
    expect(service.isTyping()).toBeFalse();
    expect(service.messages().some((m) => m.role === 'assistant')).toBeFalse();
  });

  it('resposta 422 explica o limite de tamanho', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('{}', { status: 422 }));

    await service.sendMessage('x'.repeat(3000));

    expect(service.messages()[service.messages().length - 1].content).toContain('2000');
  });
});
