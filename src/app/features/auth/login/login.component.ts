import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { AuthSignalService } from '../../../core/services/auth-signal.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>PDIR Renascente</mat-card-title>
          <mat-card-subtitle>Acesso Restrito</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>E-mail Corporativo</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" required />
              <mat-icon matSuffix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Senha</mat-label>
              <input
                matInput
                [type]="hidePassword() ? 'password' : 'text'"
                [(ngModel)]="password"
                name="password"
                required
              />
              <button mat-icon-button matSuffix (click)="togglePassword($event)" type="button">
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            @if (errorMessage()) {
              <div class="error-message">
                {{ errorMessage() }}
              </div>
            }

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="submit-btn"
              [disabled]="isLoading()"
            >
              {{ isLoading() ? 'Autenticando...' : 'Entrar no Sistema' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-container {
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #f5f5f5;
      }
      .login-card {
        width: 100%;
        max-width: 400px;
        padding: 20px;
        box-sizing: border-box;
      }
      .full-width {
        width: 100%;
        margin-bottom: 10px;
      }
      .submit-btn {
        width: 100%;
        padding: 24px 0;
        font-size: 16px;
        margin-top: 10px;
      }
      .error-message {
        color: #f44336;
        text-align: center;
        margin-bottom: 16px;
        font-weight: 500;
      }
      mat-card-header {
        justify-content: center;
        margin-bottom: 24px;
        text-align: center;
      }
    `,
  ],
})
export class LoginComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthSignalService);

  email = '';
  password = '';

  hidePassword = signal(true);
  isLoading = signal(false);
  errorMessage = signal('');

  togglePassword(event: MouseEvent): void {
    event.preventDefault();
    this.hidePassword.set(!this.hidePassword());
  }

  onSubmit(): void {
    if (!this.email || !this.password) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const body = new URLSearchParams();
    body.set('username', this.email);
    body.set('password', this.password);

    this.http
      .post<{ access_token: string }>('/api/v1/auth/token', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .subscribe({
        next: (res) => {
          // Em tese leríamos o payload decodificado aqui. Mockando para a Sprint 2.
          this.authService.updateSession(res.access_token, {
            sub: this.email,
            role: 'Dono',
            permissions: ['all'],
          });
          this.router.navigate(['/']);
        },
        error: () => {
          this.isLoading.set(false);
          this.errorMessage.set('Credenciais inválidas. Tente novamente.');
        },
      });
  }
}
