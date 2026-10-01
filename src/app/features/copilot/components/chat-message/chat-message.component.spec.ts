import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatMessage } from '../../services/copilot.service';
import { ChatMessageComponent } from './chat-message.component';

describe('ChatMessageComponent (T-45: bolhas vazias)', () => {
  let fixture: ComponentFixture<ChatMessageComponent>;

  const render = (message: ChatMessage): HTMLElement => {
    fixture.componentRef.setInput('message', message);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.markdown-body') as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChatMessageComponent] });
    fixture = TestBed.createComponent(ChatMessageComponent);
  });

  it('mostra o texto da mensagem do usuário', () => {
    const body = render({
      id: '1',
      role: 'user',
      content: 'Quais quartos estão livres?',
      isStreaming: false,
    });
    expect(body.textContent).toContain('Quais quartos estão livres?');
  });

  it('acompanha o streaming: cada novo conteúdo aparece', () => {
    render({ id: '2', role: 'assistant', content: 'Os quartos', isStreaming: true });
    const body = render({
      id: '2',
      role: 'assistant',
      content: 'Os quartos **101** e 102',
      isStreaming: false,
    });
    expect(body.textContent).toContain('Os quartos 101 e 102');
    expect(body.querySelector('strong')?.textContent).toBe('101');
  });

  it('remove HTML perigoso do Markdown', () => {
    const body = render({
      id: '3',
      role: 'assistant',
      content: 'oi <img src=x onerror="alert(1)"><script>alert(2)</script>',
      isStreaming: false,
    });
    expect(body.innerHTML).not.toContain('onerror');
    expect(body.innerHTML).not.toContain('<script');
  });
});
