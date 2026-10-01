import { SseParser } from './sse-parser';

describe('SseParser (T-31)', () => {
  const frame = (payload: object) => `data: ${JSON.stringify(payload)}\n\n`;

  it('um chunk com 3 eventos devolve os 3', () => {
    const parser = new SseParser();
    const chunk =
      frame({ event: 'message_start' }) +
      frame({ event: 'text_delta', data: 'Olá' }) +
      frame({ event: 'message_complete' });

    expect(parser.push(chunk).map((e) => e.event)).toEqual([
      'message_start',
      'text_delta',
      'message_complete',
    ]);
  });

  it('evento partido entre chunks é entregue uma vez, inteiro', () => {
    const parser = new SseParser();
    const full = frame({ event: 'text_delta', data: 'Quartos disponíveis' });

    expect(parser.push(full.slice(0, 15))).toEqual([]);
    expect(parser.push(full.slice(15))).toEqual([
      { event: 'text_delta', data: 'Quartos disponíveis' },
    ]);
  });

  it('aceita CRLF e ignora comentários de heartbeat', () => {
    const parser = new SseParser();
    const events = parser.push(':heartbeat\r\n\r\ndata: {"event":"tool_start","name":"x"}\r\n\r\n');
    expect(events).toEqual([{ event: 'tool_start', name: 'x' }]);
  });

  it('flush entrega o último evento sem linha em branco final', () => {
    const parser = new SseParser();
    expect(parser.push('data: {"event":"message_complete"}')).toEqual([]);
    expect(parser.flush()).toEqual([{ event: 'message_complete' }]);
  });

  it('JSON inválido é descartado sem afetar os demais', () => {
    const parser = new SseParser();
    const events = parser.push('data: {quebrado\n\n' + frame({ event: 'message_complete' }));
    expect(events).toEqual([{ event: 'message_complete' }]);
  });
});
