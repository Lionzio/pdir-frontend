import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthSignalService } from '../../../core/services/auth-signal.service';

// ---------------------------------------------------------------------------
// Interfaces locais
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface RegisterResponse {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <!-- ── Header corporativo "Sol Renascente" ── -->
        <div class="auth-header">
          <mat-icon class="brand-icon">hotel</mat-icon>
          <h1 class="brand-title">PDIR Renascente</h1>
          <p class="brand-subtitle">Plataforma Digital Integrada</p>
        </div>

        <!-- ── Abas: Login / Solicitar Acesso ── -->
        <mat-tab-group
          [selectedIndex]="activeTabIndex()"
          (selectedIndexChange)="activeTabIndex.set($event)"
          animationDuration="300ms"
          class="auth-tabs"
        >
          <!-- ═══════════ ABA 1: LOGIN ═══════════ -->
          <mat-tab label="Entrar">
            <div class="tab-content">
              @if (errorMessage()) {
                <div class="feedback-banner feedback-error" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ errorMessage() }}</span>
                </div>
              }

              <form (ngSubmit)="onLogin()" #loginForm="ngForm">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>E-mail Corporativo</mat-label>
                  <input
                    matInput
                    id="login-email"
                    type="email"
                    [(ngModel)]="loginEmail"
                    name="email"
                    required
                    autocomplete="email"
                  />
                  <mat-icon matSuffix>mail_outline</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Senha</mat-label>
                  <input
                    matInput
                    id="login-password"
                    [type]="hidePassword() ? 'password' : 'text'"
                    [(ngModel)]="loginPassword"
                    name="password"
                    required
                    autocomplete="current-password"
                  />
                  <button
                    mat-icon-button
                    matSuffix
                    type="button"
                    (click)="togglePassword($event)"
                    [attr.aria-label]="hidePassword() ? 'Exibir senha' : 'Ocultar senha'"
                  >
                    <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>

                <button
                  mat-flat-button
                  id="btn-login"
                  type="submit"
                  class="submit-btn"
                  [disabled]="isLoading()"
                >
                  <ng-container>
                    @if (isLoading()) {
                      <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                      <span>Autenticando...</span>
                    } @else {
                      <mat-icon>login</mat-icon>
                      <span>Entrar no Sistema</span>
                    }
                  </ng-container>
                </button>
              </form>
            </div>
          </mat-tab>

          <!-- ═══════════ ABA 2: SOLICITAR ACESSO ═══════════ -->
          <mat-tab label="Solicitar Acesso">
            <div class="tab-content">
              @if (successMessage()) {
                <div class="feedback-banner feedback-success" role="status">
                  <mat-icon>check_circle_outline</mat-icon>
                  <span>{{ successMessage() }}</span>
                </div>
              }

              @if (registerError()) {
                <div class="feedback-banner feedback-error" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ registerError() }}</span>
                </div>
              }

              <form (ngSubmit)="onRegister()" #registerForm="ngForm">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Nome Completo</mat-label>
                  <input
                    matInput
                    id="reg-fullname"
                    type="text"
                    [(ngModel)]="regFullName"
                    name="full_name"
                    required
                    minlength="3"
                    autocomplete="name"
                  />
                  <mat-icon matSuffix>person_outline</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>E-mail</mat-label>
                  <input
                    matInput
                    id="reg-email"
                    type="email"
                    [(ngModel)]="regEmail"
                    name="email"
                    required
                    autocomplete="email"
                  />
                  <mat-icon matSuffix>mail_outline</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Senha</mat-label>
                  <input
                    matInput
                    id="reg-password"
                    [type]="hideRegPassword() ? 'password' : 'text'"
                    [(ngModel)]="regPassword"
                    name="password"
                    required
                    minlength="8"
                    autocomplete="new-password"
                  />
                  <button
                    mat-icon-button
                    matSuffix
                    type="button"
                    (click)="toggleRegPassword($event)"
                  >
                    <mat-icon>{{ hideRegPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Cargo Solicitado</mat-label>
                  <mat-select id="reg-role" [(ngModel)]="regRole" name="role" required>
                    <mat-option value="RECEPCIONISTA">Recepcionista</mat-option>
                    <mat-option value="CAMAREIRA">Camareira</mat-option>
                  </mat-select>
                  <mat-icon matSuffix>badge</mat-icon>
                </mat-form-field>

                <button
                  mat-flat-button
                  id="btn-register"
                  type="submit"
                  class="submit-btn register-btn"
                  [disabled]="isRegistering()"
                >
                  <ng-container>
                    @if (isRegistering()) {
                      <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                      <span>Enviando solicitação...</span>
                    } @else {
                      <mat-icon>how_to_reg</mat-icon>
                      <span>Solicitar Cadastro</span>
                    }
                  </ng-container>
                </button>
              </form>

              <p class="register-note">
                <mat-icon class="note-icon">info_outline</mat-icon>
                Após o envio, aguarde a aprovação da gerência para ativar seu acesso.
              </p>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [
    `
      /* ── Layout principal — gradiente "Sol Renascente" ── */
      .auth-container {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 24px 16px;
        box-sizing: border-box;
        background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 50%, #d97706 100%);
      }

      /* ── Card central ── */
      .auth-card {
        width: 100%;
        max-width: 460px;
        border-radius: 20px !important;
        box-shadow:
          0 20px 25px -5px rgba(0, 0, 0, 0.5),
          0 10px 10px -5px rgba(0, 0, 0, 0.3) !important;
        background: #ffffff;
        overflow: hidden;
        padding: 0;
      }

      /* ── Header corporativo ── */
      .auth-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 32px 8px;
        text-align: center;
      }

      .brand-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #1e3a8a;
        margin-bottom: 8px;
      }

      .brand-title {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: #1e3a8a;
        letter-spacing: -0.5px;
      }

      .brand-subtitle {
        margin: 4px 0 0;
        font-size: 0.875rem;
        font-weight: 500;
        color: #d97706;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      /* ── Abas ── */
      .auth-tabs {
        margin-top: 8px;
      }

      /* ── Conteúdo de cada aba ── */
      .tab-content {
        padding: 24px 32px 32px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      /* ── Campos 100% ── */
      .full-width {
        width: 100%;
      }

      /* ── Botões de submit ── */
      .submit-btn {
        width: 100%;
        height: 48px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.3px;
        margin-top: 8px;
        background-color: #1e3a8a !important;
        color: #ffffff !important;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition:
          background-color 0.2s ease,
          transform 0.1s ease;
      }

      .submit-btn:hover:not([disabled]) {
        background-color: #1e40af !important;
        transform: translateY(-1px);
      }

      .submit-btn[disabled] {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .register-btn {
        background-color: #d97706 !important;
      }

      .register-btn:hover:not([disabled]) {
        background-color: #b45309 !important;
      }

      /* ── Spinner dentro do botão ── */
      .btn-spinner {
        display: inline-block;
        vertical-align: middle;
      }

      /* ── Banners de feedback ── */
      .feedback-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 16px;
      }

      .feedback-error {
        background-color: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
      }

      .feedback-success {
        background-color: #f0fdf4;
        color: #15803d;
        border: 1px solid #86efac;
      }

      /* ── Nota informativa abaixo do formulário ── */
      .register-note {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        margin: 12px 0 0;
        font-size: 0.8rem;
        color: #64748b;
        line-height: 1.4;
      }

      .note-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        margin-top: 1px;
        color: #d97706;
      }
    `,
  ],
})
export class LoginComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthSignalService);

  // ── Estado das abas ──
  activeTabIndex = signal(0);

  // ── Estado do formulário de Login ──
  loginEmail = '';
  loginPassword = '';
  hidePassword = signal(true);
  isLoading = signal(false);
  errorMessage = signal('');

  // ── Estado do formulário de Registro ──
  regEmail = '';
  regPassword = '';
  regFullName = '';
  regRole = 'RECEPCIONISTA';
  hideRegPassword = signal(true);
  isRegistering = signal(false);
  registerError = signal('');
  successMessage = signal('');

  // ── Handlers de visibilidade de senha ──

  togglePassword(event: MouseEvent): void {
    event.preventDefault();
    this.hidePassword.set(!this.hidePassword());
  }

  toggleRegPassword(event: MouseEvent): void {
    event.preventDefault();
    this.hideRegPassword.set(!this.hideRegPassword());
  }

  // ── Login ──

  onLogin(): void {
    if (!this.loginEmail || !this.loginPassword) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const body = new URLSearchParams();
    body.set('username', this.loginEmail);
    body.set('password', this.loginPassword);

    this.http
      .post<TokenResponse>('/api/v1/auth/token', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .subscribe({
        next: (res) => {
          // Decodifica o payload JWT minimamente para popular o AuthSignalService
          const parts = res.access_token.split('.');
          let payload: { sub?: string; role?: string; permissions?: string[] } = {};
          if (parts.length === 3) {
            try {
              payload = JSON.parse(atob(parts[1]));
            } catch {
              // payload inválido: usa fallback abaixo
            }
          }

          this.authService.updateSession(res.access_token, {
            sub: payload.sub ?? this.loginEmail,
            role: payload.role ?? '',
            permissions: payload.permissions ?? [],
          });

          this.router.navigate(['/admin/rooms']);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);

          if (err.status === 403) {
            this.errorMessage.set(
              'Acesso restrito: Seu cadastro ainda está sob análise da gerência.',
            );
          } else {
            this.errorMessage.set('E-mail ou senha incorretos.');
          }
        },
      });
  }

  // ── Registro ──

  onRegister(): void {
    if (!this.regEmail || !this.regPassword || !this.regFullName) return;

    this.isRegistering.set(true);
    this.registerError.set('');
    this.successMessage.set('');

    this.http
      .post<RegisterResponse>('/api/v1/auth/register', {
        email: this.regEmail,
        password: this.regPassword,
        full_name: this.regFullName,
        role: this.regRole,
      })
      .subscribe({
        next: () => {
          // Limpa o formulário
          this.regEmail = '';
          this.regPassword = '';
          this.regFullName = '';
          this.regRole = 'RECEPCIONISTA';

          this.isRegistering.set(false);
          this.successMessage.set('Cadastro enviado! Aguarde aprovação do gestor.');

          // Muda para a aba de Login após 2s
          setTimeout(() => {
            this.successMessage.set('');
            this.activeTabIndex.set(0);
          }, 2500);
        },
        error: (err: HttpErrorResponse) => {
          this.isRegistering.set(false);
          const detail = err.error?.detail;
          this.registerError.set(
            typeof detail === 'string' ? detail : 'Falha ao enviar cadastro. Verifique os dados.',
          );
        },
      });
  }
}
