#!/usr/bin/env node
/**
 * Dados FICTÍCIOS para o projeto Supabase de TESTES do app Prioridades e Urgências.
 *
 *   node scripts/prioridades-v2/seed-testes.mjs
 *
 * 1. Cria (se ainda não existirem) os usuários de teste, um por perfil, via API admin.
 *    As senhas geradas vão para `.env.usuarios-teste` (ignorado pelo Git).
 * 2. Roda `seed-testes.sql` no projeto ligado (supabase link), que provisiona os perfis
 *    e cria anotações passando pelas mesmas RPCs do app (histórico coerente).
 *
 * TRAVA: só roda se o .env E o projeto ligado forem o de testes. Nunca na produção.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REF_TESTES = 'utjkliwzwmifejqysmsy';
const REF_PRODUCAO = 'lhofkimrmzyjazfpqesd';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lerEnv = (arquivo) => {
  const p = path.join(raiz, arquivo);
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
};

const env = lerEnv('.env');
const url = env.VITE_SUPABASE_URL ?? '';
const chave = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const refLigado = fs.existsSync(path.join(raiz, 'supabase/.temp/project-ref'))
  ? fs.readFileSync(path.join(raiz, 'supabase/.temp/project-ref'), 'utf8').trim()
  : '';

if (url.includes(REF_PRODUCAO) || refLigado === REF_PRODUCAO) {
  console.error('RECUSADO: .env ou projeto ligado apontam para a PRODUÇÃO.');
  process.exit(1);
}
if (!url.includes(REF_TESTES) || refLigado !== REF_TESTES) {
  console.error(`RECUSADO: esperado o projeto de testes (${REF_TESTES}). .env=${url || '(vazio)'} ligado=${refLigado || '(nenhum)'}`);
  process.exit(1);
}
if (!chave) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}

// Usuários fictícios. O papel do app (perfil) é dado pelo SQL; aqui só o cadastro.
const USUARIOS = [
  { email: 'admin.teste@example.com', nome: 'Admin Teste', role: 'admin' },
  { email: 'gestor.teste@example.com', nome: 'Gustavo Gestor (teste)' },
  { email: 'conferente.teste@example.com', nome: 'Carla Conferente (teste)' },
  { email: 'atendente.teste@example.com', nome: 'Mônica Atendente (teste)' },
  { email: 'atendente2.teste@example.com', nome: 'Ricardo Atendente (teste)' },
  { email: 'coord.upj9.teste@example.com', nome: 'Silvia Coordenadora UPJ IX (teste)' },
  { email: 'analista.upj9.teste@example.com', nome: 'Alberto Analista UPJ IX (teste)' },
  { email: 'coord.upj6.teste@example.com', nome: 'Vera Coordenadora UPJ VI (teste)' },
];

const supabase = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: lista, error: erroLista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (erroLista) throw erroLista;
const existentes = new Set(lista.users.map((u) => u.email?.toLowerCase()));

const arqSenhas = path.join(raiz, '.env.usuarios-teste');
const novasLinhas = [];
for (const u of USUARIOS) {
  if (existentes.has(u.email)) {
    console.log(`= já existe: ${u.email}`);
    continue;
  }
  const senha = randomBytes(12).toString('base64url');
  const { error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: u.nome, ...(u.role ? { role: u.role } : {}) },
  });
  if (error) throw new Error(`${u.email}: ${error.message}`);
  novasLinhas.push(`# ${u.nome}`, `${u.email}=${senha}`);
  console.log(`+ criado: ${u.email}`);
}
if (novasLinhas.length) {
  const cabecalho = fs.existsSync(arqSenhas) ? '' :
    '# Usuários FICTÍCIOS do projeto de TESTES (utjkliwzwmifejqysmsy). Ignorado pelo Git.\n# Formato: e-mail=senha\n';
  fs.appendFileSync(arqSenhas, cabecalho + novasLinhas.join('\n') + '\n');
  console.log(`Senhas novas gravadas em ${path.basename(arqSenhas)}`);
}

// Todos na equipe "Atende" do Gerenciador (os da UPJ também, por ora: não há equipe de UPJ no seed).
const { data: equipe } = await supabase.from('equipes').select('id, setor_id').eq('nome', 'Atende').maybeSingle();
if (equipe) {
  const { error } = await supabase.from('users')
    .update({ equipe_id: equipe.id, setor_id: equipe.setor_id })
    .in('email', USUARIOS.map((u) => u.email));
  if (error) throw error;
}

if (process.argv.includes('--so-usuarios')) process.exit(0);

console.log('\nAplicando perfis e anotações (seed-testes.sql)...');
const sql = 'scripts/prioridades-v2/seed-testes.sql'; // relativo a `raiz`: sem espaços nem acentos no comando
// Binário do CLI instalado pelo npm (sem shell: argumentos passados sem concatenação).
const cli = path.join(raiz, 'node_modules', 'supabase', 'bin', process.platform === 'win32' ? 'supabase.exe' : 'supabase');
const saida = execFileSync(cli, ['db', 'query', '--linked', '-o', 'table', '-f', sql], {
  cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
console.log(saida);
