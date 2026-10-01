/** Evento do stream do Copilot (`data: {...}` no formato Server-Sent Events). */
export interface CopilotEvent {
  event: string;
  data?: string;
  name?: string;
}

/**
 * Parser incremental de Server-Sent Events (T-31).
 *
 * Os chunks do `fetch` chegam em pedaços arbitrários: um chunk pode trazer vários eventos ou só parte
 * de um. O parser acumula o texto, separa os eventos pela linha em branco e guarda o resto incompleto
 * para o próximo chunk. Antes, o texto era dividido pelo literal "\n" (barra + n) e os eventos se perdiam.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): CopilotEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n');
    const blocks = this.buffer.split('\n\n');
    this.buffer = blocks.pop() ?? '';
    return blocks.flatMap((block) => this.parseBlock(block));
  }

  /** Processa o que restou no buffer quando o stream termina sem a linha em branco final. */
  flush(): CopilotEvent[] {
    const rest = this.buffer;
    this.buffer = '';
    return rest.trim() ? this.parseBlock(rest) : [];
  }

  private parseBlock(block: string): CopilotEvent[] {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart())
      .join('\n');
    if (!data) return [];
    try {
      return [JSON.parse(data) as CopilotEvent];
    } catch {
      return [];
    }
  }
}
