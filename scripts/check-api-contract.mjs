// Contrato frontend–backend (T-44).
//
// Uso: npm run api:check [-- <caminho do contracts/openapi.json do backend>]
//   (ou a variável BACKEND_OPENAPI)
//
// 1. src/app/core/api/schema.ts precisa ser exatamente o que o openapi-typescript gera de api/openapi.json.
// 2. Com o contrato do backend informado, api/openapi.json precisa ser igual a ele. Uma diferença lista o
//    que quebra o frontend (operação, schema ou campo removido; campo que virou obrigatório; tipo alterado).
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as prettier from 'prettier';

const OPENAPI = 'api/openapi.json';
const SCHEMA = 'src/app/core/api/schema.ts';
const GENERATOR = 'openapi-typescript@7.13.0';

let failed = false;
const fail = (message) => {
  console.error(`✖ ${message}`);
  failed = true;
};

// --- 1. schema.ts gerado do openapi.json local -------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), 'pdir-contract-'));
try {
  const generated = join(tmp, 'schema.ts');
  execSync(`npx --yes ${GENERATOR} "${OPENAPI}" -o "${generated}"`, { stdio: 'pipe' });
  const options = { ...(await prettier.resolveConfig(SCHEMA)), filepath: SCHEMA };
  const expected = await prettier.format(readFileSync(generated, 'utf8'), options);
  const committed = readFileSync(SCHEMA, 'utf8').replace(/\r\n/g, '\n');
  if (expected !== committed) {
    fail(`${SCHEMA} não corresponde a ${OPENAPI}. Rode: npm run api:types`);
  } else {
    console.log(`✔ ${SCHEMA} gerado de ${OPENAPI}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// --- 2. openapi.json local igual ao contrato publicado pelo backend -------------------------------
const operations = (spec) =>
  new Set(
    Object.entries(spec.paths ?? {}).flatMap(([path, item]) =>
      Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
    ),
  );

/** O que, na troca de `local` (o que o frontend usa) por `backend`, quebra o frontend. */
function breakingChanges(local, backend) {
  const problems = [];
  const backendOps = operations(backend);
  for (const op of operations(local))
    if (!backendOps.has(op)) problems.push(`operação removida: ${op}`);
  const localSchemas = local.components?.schemas ?? {};
  const backendSchemas = backend.components?.schemas ?? {};
  for (const [name, schema] of Object.entries(localSchemas)) {
    const next = backendSchemas[name];
    if (!next) {
      problems.push(`schema removido: ${name}`);
      continue;
    }
    const props = schema.properties ?? {};
    const nextProps = next.properties ?? {};
    for (const prop of Object.keys(props)) {
      if (!(prop in nextProps)) problems.push(`campo removido: ${name}.${prop}`);
      else if (props[prop].type !== nextProps[prop].type)
        problems.push(
          `tipo alterado: ${name}.${prop} (${props[prop].type} → ${nextProps[prop].type})`,
        );
    }
    const required = new Set(schema.required ?? []);
    for (const prop of next.required ?? [])
      if (!required.has(prop)) problems.push(`campo passou a ser obrigatório: ${name}.${prop}`);
  }
  return problems;
}

const canonical = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

const backendPath = process.argv[2] ?? process.env.BACKEND_OPENAPI;
if (!backendPath) {
  console.log('ℹ Contrato do backend não informado: só a consistência local foi verificada.');
} else if (!existsSync(backendPath)) {
  fail(`Contrato do backend não encontrado em ${backendPath}`);
} else {
  const local = JSON.parse(readFileSync(OPENAPI, 'utf8'));
  const backend = JSON.parse(readFileSync(backendPath, 'utf8'));
  if (canonical(local) === canonical(backend)) {
    console.log(`✔ ${OPENAPI} igual ao contrato do backend (${backendPath})`);
  } else {
    const breaking = breakingChanges(local, backend);
    fail(
      [
        `${OPENAPI} difere do contrato do backend (${backendPath}).`,
        ...(breaking.length
          ? ['  Mudanças que quebram o frontend:', ...breaking.map((p) => `    - ${p}`)]
          : ['  Só mudanças aditivas.']),
        '  Copie o contracts/openapi.json do backend para api/openapi.json, rode npm run api:types e ajuste o código.',
      ].join('\n'),
    );
  }
}

process.exit(failed ? 1 : 0);
