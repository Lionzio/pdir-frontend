import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { CopilotService } from '../services/copilot.service';
import { ChatMessageComponent } from './chat-message/chat-message.component';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    FormsModule,
    ChatMessageComponent,
  ],
  template: `
    @if (copilot.isVisible()) {
      <div class="copilot-container">
        <div class="chat-window">
          <!-- Header -->
          <div class="chat-header">
            <div class="header-title">
              <mat-icon>auto_awesome</mat-icon>
              <span>PDIR Copilot</span>
            </div>
            <button mat-icon-button (click)="copilot.toggleVisibility()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Messages Area -->
          <div class="chat-messages" #scrollMe>
            @if (copilot.messages().length === 0) {
              <div class="welcome-message">
                <mat-icon class="welcome-icon">auto_awesome</mat-icon>
                <h3>Como posso ajudar?</h3>
                <p>Eu posso consultar reservas, quartos, extratos e políticas do hotel.</p>
              </div>
            }
            
            @for (msg of copilot.messages(); track msg.id) {
              <app-chat-message [message]="msg"></app-chat-message>
            }
          </div>

          <!-- Input Area -->
          <div class="chat-input-area">
            <input 
              type="text" 
              class="chat-input" 
              [(ngModel)]="inputText" 
              (keyup.enter)="sendMessage()"
              placeholder="Digite sua mensagem..." 
              [disabled]="copilot.isTyping()"
            />
            <button mat-icon-button color="primary" (click)="sendMessage()" [disabled]="copilot.isTyping() || !inputText.trim()">
              <mat-icon>send</mat-icon>
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Floating Action Button -->
    @if (!copilot.isVisible()) {
      <button class="fab" mat-fab color="primary" (click)="copilot.toggleVisibility()">
        <mat-icon>auto_awesome</mat-icon>
      </button>
    }
  `,
  styles: [
    `
      .copilot-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 1000;
      }
      .chat-window {
        width: 380px;
        height: 600px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #e0e0e0;
      }
      .chat-header {
        background: #1976d2;
        color: white;
        padding: 8px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
      }
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f8f9fa;
        scroll-behavior: smooth;
      }
      .welcome-message {
        text-align: center;
        color: #666;
        margin-top: 40px;
      }
      .welcome-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #1976d2;
        margin-bottom: 16px;
      }
      .chat-input-area {
        display: flex;
        padding: 12px;
        background: white;
        border-top: 1px solid #e0e0e0;
        gap: 8px;
        align-items: center;
      }
      .chat-input {
        flex: 1;
        border: 1px solid #e0e0e0;
        border-radius: 20px;
        padding: 10px 16px;
        outline: none;
        font-size: 14px;
        transition: border-color 0.2s;
      }
      .chat-input:focus {
        border-color: #1976d2;
      }
      .fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 1000;
      }
    `,
  ],
  animations: [],
})
export class ChatWidgetComponent implements AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  inputText: string = '';

  constructor(public copilot: CopilotService) {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop =
        this.myScrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  sendMessage() {
    if (!this.inputText.trim()) return;
    const text = this.inputText;
    this.inputText = '';
    this.copilot.sendMessage(text);
  }
}
