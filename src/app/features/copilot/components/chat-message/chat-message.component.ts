import { Component, Input, OnChanges, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatMessage } from '../services/copilot.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="message-container" [ngClass]="{'user': message.role === 'user', 'ai': message.role === 'assistant'}">
      
      <div class="avatar">
        @if (message.role === 'user') { <mat-icon>person</mat-icon> }
        @if (message.role === 'assistant') { <mat-icon>auto_awesome</mat-icon> }
      </div>

      <div class="content-box">
        <!-- Tools Badges -->
        @if (message.toolCalls?.length) {
          <div class="tool-badges">
            @for (tc of message.toolCalls; track tc.name) {
              <div class="tool-badge" [ngClass]="tc.status">
                @if (tc.status === 'running') { <mat-icon class="spin">sync</mat-icon> }
                @if (tc.status === 'completed') { <mat-icon>check_circle</mat-icon> }
                <span>Usando ferramenta: {{ tc.name }}</span>
              </div>
            }
          </div>
        }

        <!-- Rendered Markdown Content -->
        <div class="markdown-body" [innerHTML]="safeHtml"></div>
        
        @if (message.isStreaming && !message.content) {
          <div class="typing-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .message-container {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        padding: 12px;
        border-radius: 8px;
      }
      .message-container.user {
        flex-direction: row-reverse;
      }
      .avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ai .avatar {
        background: #e3f2fd;
        color: #1976d2;
      }
      .user .avatar {
        background: #f5f5f5;
      }
      .content-box {
        max-width: 80%;
        background: #ffffff;
        padding: 12px 16px;
        border-radius: 12px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        border: 1px solid #e0e0e0;
      }
      .user .content-box {
        background: #e8f5e9;
        border-color: #c8e6c9;
      }
      .markdown-body {
        font-size: 14px;
        line-height: 1.5;
      }
      /* Simple Markdown styling */
      ::ng-deep .markdown-body p {
        margin: 0 0 8px 0;
      }
      ::ng-deep .markdown-body ul {
        margin: 0 0 8px 0;
        padding-left: 20px;
      }

      .tool-badges {
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tool-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        padding: 4px 8px;
        background: #f5f5f5;
        border-radius: 4px;
        color: #666;
        border: 1px solid #e0e0e0;
      }
      .tool-badge.running {
        color: #f57c00;
        background: #fff3e0;
        border-color: #ffe0b2;
      }
      .tool-badge.completed {
        color: #388e3c;
        background: #e8f5e9;
        border-color: #c8e6c9;
      }
      .tool-badge mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .spin {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }

      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 4px;
      }
      .dot {
        width: 6px;
        height: 6px;
        background: #999;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both;
      }
      .dot:nth-child(1) {
        animation-delay: -0.32s;
      }
      .dot:nth-child(2) {
        animation-delay: -0.16s;
      }
      @keyframes bounce {
        0%,
        80%,
        100% {
          transform: scale(0);
        }
        40% {
          transform: scale(1);
        }
      }
    `,
  ],
})
export class ChatMessageComponent implements OnChanges {
  @Input() message!: ChatMessage;
  safeHtml: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  async ngOnChanges() {
    if (this.message && this.message.content) {
      // 1. Convert Markdown to HTML
      const rawHtml = await marked.parse(this.message.content, { async: true });

      // 2. Sanitize HTML using DOMPurify
      const purifiedHtml = DOMPurify.sanitize(rawHtml);

      // 3. Bypass Angular Trust ONLY after strict DOMPurify filtering
      // (Angular's sanitize isn't perfect for raw HTML injection, DOMPurify is industry standard)
      this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(purifiedHtml);
    }
  }
}
