# PDIR — Frontend (Angular)

SPA da **Plataforma Digital Integrada Renascente (PDIR)**, sistema de gestão do Renascente Hotel:
login com aprovação de cadastro, mapa de quartos em tempo real, reservas (timeline e assistente de
nova reserva), financeiro (Kanban de inadimplência, extrato, lançamentos, fechamento e estorno),
sincronização com Google Sheets e o Copilot de IA. A API fica em
[Lionzio/pdir-backend](https://github.com/Lionzio/pdir-backend).

## Stack

| Camada             | Tecnologia                                                                |
| ------------------ | ------------------------------------------------------------------------- |
| Framework          | Angular 22 (componentes standalone, Signals, rotas lazy)                  |
| UI                 | Angular Material / CDK                                                    |
| Linguagem          | TypeScript 6 (strict)                                                     |
| Reatividade e HTTP | RxJS, HttpClient com interceptor funcional (Bearer + refresh)             |
| Testes             | Karma + Jasmine, Chrome headless baixado pelo puppeteer                   |
| Qualidade          | ESLint (angular-eslint, typescript-eslint), Prettier, Husky + lint-staged |

## Pré-requisitos

- **Node.js 22** (`^22.22.3`) **ou 24** (`^24.15.0`), as versões aceitas pelo Angular 22. Confira com `node -v`.
- **npm** (vem com o Node)
- **Backend rodando** em `http://127.0.0.1:8000`: siga o README do pdir-backend até a API responder em `/readyz`.

## Primeiros passos

1. **Clonar e instalar**, usando o lock (`npm ci`, não `npm install`):

   ```bash
   git clone https://github.com/Lionzio/pdir-frontend.git
   cd pdir-frontend
   npm ci
   ```

   O `npm ci` também baixa o Chrome dos testes, via puppeteer, e instala os hooks do Husky.
   No npm 11 ou mais novo, scripts de instalação só rodam se aprovados: o `package.json` já aprova
   `puppeteer` e `esbuild` (campo `allowScripts`) e bloqueia três módulos nativos opcionais, que já
   vêm com binários pré-compilados.

2. **Subir o servidor de desenvolvimento:**

   ```bash
   npm start
   ```

   Abra `http://localhost:4200`. O `ng serve` usa o [`proxy.conf.json`](proxy.conf.json): toda chamada
   a `/api` vai para `http://127.0.0.1:8000`, sem CORS.

3. **Entrar** com o administrador criado pelo seed do backend: `ADMIN_EMAIL` e `ADMIN_PASSWORD` do
   `.env` do pdir-backend; o e-mail padrão é `admin@pdir.com`. Novos funcionários podem se cadastrar
   na tela de login e ficam pendentes até um DONO ou GERENTE aprovar.

## Scripts

| Comando                                   | O que faz                                                   |
| ----------------------------------------- | ----------------------------------------------------------- |
| `npm start`                               | servidor de desenvolvimento com proxy para a API            |
| `npm test`                                | testes unitários (Karma, Chrome headless, execução única)   |
| `npm test -- --code-coverage`             | testes + relatório de cobertura em `coverage/`              |
| `npm run lint`                            | ESLint em `src/**/*.{ts,html}`                              |
| `npm run format:check` / `npm run format` | confere / aplica o Prettier                                 |
| `npm run build`                           | build de produção em `dist/pdir-frontend`                   |
| `npm run api:types`                       | regenera `src/app/core/api/schema.ts` de `api/openapi.json` |

### Tipos do contrato da API

Os modelos (`Room`, `RoomStatus`, categorias...) derivam de `src/app/core/api/schema.ts`, gerado do OpenAPI do backend.
Quando a API mudar:

```bash
# no pdir-backend
uv run python -m app.export_openapi > ../pdir-frontend/api/openapi.json
# no pdir-frontend
npm run api:types
```

O `tsc` passa a acusar qualquer divergência entre o frontend e o contrato.

Antes de cada commit, o Husky roda o `lint-staged` (ESLint `--fix` + Prettier nos arquivos alterados).

## Configuração por ambiente

A raiz da API vem de `src/environments/` (T-36) e chega aos serviços pelo token `API_BASE_URL`:

| Arquivo                      | Usado em                   | `apiBaseUrl`                                                          |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `environment.development.ts` | `npm start` / `ng serve`   | `/api/v1` (o proxy encaminha para `127.0.0.1:8000`)                   |
| `environment.ts`             | `npm run build` (produção) | `/api/v1` (frontend e API na mesma origem, atrás de um reverse proxy) |

Para publicar com a API em outro host, troque `apiBaseUrl` em `environment.ts` pela URL absoluta (ex.:
`https://api.hotel.example/api/v1`) ou crie uma configuração nova no `angular.json` com o seu
`fileReplacements`. Do lado do backend, o host do frontend precisa estar em `CORS_ALLOWED_ORIGINS`, e os
dois devem ser do **mesmo site** (ex.: `app.hotel.example` e `api.hotel.example`), porque o cookie do
refresh token é `SameSite=Strict`.

## CI

O [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em todo push para `main`/`develop` e em todo PR, com Node 22 e quatro jobs:

- **qualidade:** ESLint, Prettier e `tsc --noEmit`;
- **testes:** com cobertura publicada como artefato;
- **build** de produção;
- **gitleaks** no histórico completo.

## Fluxo de branches

`feature/*` ou `fix/*` → PR para **`develop`** (branch padrão) → PR `develop` → `main`.
A `develop` deve estar sempre igual à `main` ou à frente dela.

## Estrutura

```text
src/app/
  core/        guard, interceptor de autenticação, diretiva RBAC, serviços de sessão e utilitários
  features/
    auth/          login e cadastro
    rooms/         mapa de quartos (SSE), diálogos de status e de edição
    reservations/  timeline e assistente de nova reserva
    finance/       painel financeiro
    admin/         painel de sincronização com o Google Sheets
    copilot/       widget de chat com a IA
  app.routes.ts  rotas (lazy loading)
```

## Windows

- O repositório tem um [`.gitattributes`](.gitattributes) com `eol=lf`. Sem ele, um clone com
  `core.autocrlf=true` vira CRLF e o lint acusa milhares de erros de Prettier.
- O histórico foi reescrito em 30/09/2026 para remover o `node_modules`. Clones anteriores precisam ser **reclonados**.

## Solução de problemas

| Sintoma                                              | Causa e solução                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "The Angular CLI requires a minimum Node.js version" | Node fora do intervalo aceito: instale o Node 22 ou 24.                                                              |
| Login falha com erro de rede ou 504                  | Backend fora do ar ou em outra porta: confira `http://127.0.0.1:8000/readyz`.                                        |
| `npm test` não encontra o Chrome                     | Rode `npm ci` de novo (o puppeteer baixa o Chrome) ou defina `CHROME_BIN`.                                           |
| Lint acusa `Delete ␍` em todas as linhas             | Arquivos com CRLF: com o `.gitattributes`, rode `git rm -r --cached . && git reset --hard` num clone sem alterações. |
