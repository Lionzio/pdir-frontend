import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterOutlet } from '@angular/router';

import { AuthSignalService } from './core/services/auth-signal.service';
import { LogoutService } from './core/services/logout.service';
import { ChatWidgetComponent } from './features/copilot/components/chat-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatWidgetComponent, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'pdir-frontend';
  // O Copilot só existe para usuário autenticado (não aparece no /login) — T-31
  readonly auth = inject(AuthSignalService);
  private readonly logoutService = inject(LogoutService);
  readonly loggingOut = signal(false);

  async logout(): Promise<void> {
    this.loggingOut.set(true);
    try {
      await this.logoutService.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
