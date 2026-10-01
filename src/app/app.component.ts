import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthSignalService } from './core/services/auth-signal.service';
import { ChatWidgetComponent } from './features/copilot/components/chat-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatWidgetComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'pdir-frontend';
  // O Copilot só existe para usuário autenticado (não aparece no /login) — T-31
  readonly auth = inject(AuthSignalService);
}
