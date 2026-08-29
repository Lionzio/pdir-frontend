import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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
}
