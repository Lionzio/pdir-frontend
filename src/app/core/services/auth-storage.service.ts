import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface StoredSession {
  token: string;
  payload: {
    sub: string;
    user_id: number;
    role: string;
    permissions: string[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthStorageService {
  private readonly STORAGE_KEY = 'auth_session';
  private platformId = inject(PLATFORM_ID);

  // Utilizar o storage apropriado apenas se estiver no browser (evita erros em SSR)
  private get storage(): Storage | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage;
    }
    return null;
  }

  saveSession(session: StoredSession): void {
    if (this.storage) {
      this.storage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    }
  }

  getSession(): StoredSession | null {
    if (this.storage) {
      const data = this.storage.getItem(this.STORAGE_KEY);
      if (data) {
        try {
          return JSON.parse(data) as StoredSession;
        } catch {
          this.clearSession(); // Limpa se os dados estiverem corrompidos
          return null;
        }
      }
    }
    return null;
  }

  clearSession(): void {
    if (this.storage) {
      this.storage.removeItem(this.STORAGE_KEY);
    }
  }

  getStorageKey(): string {
    return this.STORAGE_KEY;
  }
}
