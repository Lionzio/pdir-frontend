import { APIRequestContext, expect, request } from '@playwright/test';

import { API_URL, E2E } from './env';

/** CPF fictício com dígitos verificadores válidos (mesma regra do backend). */
export function fakeCpf(): string {
  let digits: number[];
  do {
    digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  } while (new Set(digits).size === 1);
  for (const size of [9, 10]) {
    const total = digits.slice(0, size).reduce((sum, d, i) => sum + d * (size + 1 - i), 0);
    digits.push(((total * 10) % 11) % 10);
  }
  return digits.join('');
}

/** Data de hoje no fuso do hotel (UTC−3), deslocada em `days`, como YYYY-MM-DD. */
export function hotelDate(days = 0): string {
  const now = new Date(Date.now() - 3 * 3600 * 1000);
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString().slice(0, 10);
}

export const uid = (): string => Math.random().toString(36).slice(2, 8);

/** Domínio dos e-mails de teste: o validador de e-mail do backend recusa domínios reservados (.test). */
export const E2E_EMAIL_DOMAIN = 'pdir-e2e.com.br';

export interface RoomDto {
  id: number;
  number: string;
  status: string;
}

/** Cliente da API autenticado, para preparar e conferir dados sem passar pela interface. */
export class Api {
  private constructor(private readonly ctx: APIRequestContext) {}

  static async login(email = E2E.adminEmail, password = E2E.adminPassword): Promise<Api> {
    const anon = await request.newContext({ baseURL: `${API_URL}/` });
    const res = await anon.post('auth/token', { form: { username: email, password } });
    expect(res.status(), `login de ${email}`).toBe(200);
    const { access_token } = (await res.json()) as { access_token: string };
    await anon.dispose();
    const ctx = await request.newContext({
      baseURL: `${API_URL}/`,
      extraHTTPHeaders: { Authorization: `Bearer ${access_token}` },
    });
    return new Api(ctx);
  }

  async json<T>(
    method: 'get' | 'post' | 'patch',
    path: string,
    data?: unknown,
    expected = 200,
  ): Promise<T> {
    const res = await this.ctx[method](path, data === undefined ? undefined : { data });
    expect(res.status(), `${method.toUpperCase()} ${path}: ${await res.text()}`).toBe(expected);
    return (await res.json()) as T;
  }

  async room(number: string): Promise<RoomDto> {
    const rooms = await this.json<RoomDto[]>('get', 'rooms?page_size=200');
    const room = rooms.find((r) => r.number === number);
    expect(room, `quarto ${number} semeado`).toBeTruthy();
    return room!;
  }

  async setRoomStatus(number: string, status: string): Promise<void> {
    const room = await this.room(number);
    if (room.status !== status) await this.json('patch', `rooms/${room.id}/status`, { status });
  }

  async reservations(
    start: string,
    end: string,
  ): Promise<{ id: number; room_id: number; status: string }[]> {
    return this.json('get', `reservations?start_date=${start}&end_date=${end}`);
  }

  /** Cria um funcionário pelo autocadastro e, se pedido, aprova com o admin. */
  async staff(
    role: 'RECEPCIONISTA' | 'CAMAREIRA',
    approve = true,
  ): Promise<{ email: string; password: string }> {
    const email = `${role.toLowerCase()}.${uid()}@${E2E_EMAIL_DOMAIN}`;
    const password = `senha-e2e-${uid()}`;
    const anon = await request.newContext({ baseURL: `${API_URL}/` });
    const res = await anon.post('auth/register', {
      data: { email, password, full_name: `Funcionária ${uid()}`, role },
    });
    expect(res.status()).toBe(201);
    const { id } = (await res.json()) as { id: number };
    await anon.dispose();
    if (approve) await this.json('patch', `iam/users/${id}/status`, { status: 'APPROVED' });
    return { email, password };
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }
}
