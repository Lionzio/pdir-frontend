// Sobe a API para os testes E2E (T-45), usada como `webServer` do Playwright.
//
// 1. Postgres (pgvector) e Redis descartáveis: docker compose (e2e/docker-compose.e2e.yml) ou, no CI,
//    os services do workflow (E2E_SKIP_COMPOSE=1).
// 2. Banco `pdir_e2e` recriado do zero, Redis limpo e `alembic upgrade head`.
// 3. uvicorn na porta E2E com seed automático (admin de teste e 27 quartos), chaves JWT efêmeras,
//    access token curto (FC10), sem chaves de IA e sem credencial do Google.
//
// Variáveis: PDIR_BACKEND_DIR (padrão ../pdir-backend), PDIR_PYTHON (padrão .venv do backend).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '..', '..');
const backendDir = resolve(process.env.PDIR_BACKEND_DIR ?? join(frontendDir, '..', 'pdir-backend'));
const windows = process.platform === 'win32';
const python =
  process.env.PDIR_PYTHON ??
  join(backendDir, '.venv', windows ? 'Scripts' : 'bin', windows ? 'python.exe' : 'python');

if (!existsSync(join(backendDir, 'app', 'main.py'))) {
  console.error(`[e2e] backend não encontrado em ${backendDir}. Defina PDIR_BACKEND_DIR.`);
  process.exit(1);
}

const db = {
  host: process.env.E2E_POSTGRES_HOST ?? '127.0.0.1',
  port: process.env.E2E_POSTGRES_PORT ?? '55433',
  user: process.env.E2E_POSTGRES_USER ?? 'pdir',
  password: process.env.E2E_POSTGRES_PASSWORD ?? 'pdir_e2e',
  name: 'pdir_e2e',
};
const redis = {
  host: process.env.E2E_REDIS_HOST ?? '127.0.0.1',
  port: process.env.E2E_REDIS_PORT ?? '56380',
};

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts });

if (!process.env.E2E_SKIP_COMPOSE) {
  console.log('[e2e] subindo Postgres e Redis (docker compose)...');
  run('docker', [
    'compose',
    '-f',
    join(here, '..', 'docker-compose.e2e.yml'),
    'up',
    '-d',
    '--wait',
  ]);
}

console.log('[e2e] recriando o banco pdir_e2e e limpando o Redis...');
run(python, [
  '-c',
  [
    'import psycopg2, redis, sys',
    `c = psycopg2.connect(host=${JSON.stringify(db.host)}, port=${db.port}, user=${JSON.stringify(db.user)}, password=${JSON.stringify(db.password)}, dbname="postgres")`,
    'c.autocommit = True',
    'cur = c.cursor()',
    `cur.execute("DROP DATABASE IF EXISTS ${db.name} WITH (FORCE)")`,
    `cur.execute("CREATE DATABASE ${db.name}")`,
    `redis.Redis(host=${JSON.stringify(redis.host)}, port=${redis.port}).flushdb()`,
  ].join('\n'),
]);

// Par RSA efêmero: os testes nunca usam as chaves reais do backend
const keys = JSON.parse(
  run(python, [
    '-c',
    [
      'import json',
      'from cryptography.hazmat.primitives import serialization',
      'from cryptography.hazmat.primitives.asymmetric import rsa',
      'k = rsa.generate_private_key(public_exponent=65537, key_size=2048)',
      'priv = k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()',
      'pub = k.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()',
      'print(json.dumps({"private": priv, "public": pub}))',
    ].join('\n'),
  ]),
);

const env = {
  ...process.env,
  POSTGRES_HOST: db.host,
  POSTGRES_PORT: db.port,
  POSTGRES_USER: db.user,
  POSTGRES_PASSWORD: db.password,
  POSTGRES_DB: db.name,
  REDIS_HOST: redis.host,
  REDIS_PORT: redis.port,
  ENVIRONMENT: 'development',
  AUTO_SEED: 'true',
  ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL ?? 'admin.e2e@pdir.test',
  ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin-senha-local',
  ACCESS_TOKEN_EXPIRE_MINUTES: process.env.E2E_ACCESS_TOKEN_MINUTES ?? '1',
  JWT_PRIVATE_KEY: keys.private,
  JWT_PUBLIC_KEY: keys.public,
  OPENAI_API_KEY: '',
  GEMINI_API_KEY: '',
  GROQ_API_KEY: '',
  GOOGLE_SERVICE_ACCOUNT_FILE: 'e2e-sem-credencial-google.json',
  GOOGLE_SPREADSHEET_ID: '',
  CORS_ALLOWED_ORIGINS: `http://localhost:${process.env.E2E_FRONTEND_PORT ?? 4300}`,
  PYTHONIOENCODING: 'utf-8',
};

console.log('[e2e] aplicando as migrations...');
run(python, ['-m', 'alembic', 'upgrade', 'head'], { cwd: backendDir, env });

const port = process.env.E2E_BACKEND_PORT ?? '8001';
console.log(`[e2e] API em http://127.0.0.1:${port}`);
const api = spawn(
  python,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', port],
  {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  },
);
const stop = () => api.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);
api.on('exit', (code) => process.exit(code ?? 0));
