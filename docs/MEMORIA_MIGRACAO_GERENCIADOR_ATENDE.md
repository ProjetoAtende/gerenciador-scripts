# Memória de execução — Gerenciador Atende

Documento de continuidade da migração e recorte do **Gerenciador de Chamados** para o **Gerenciador Atende**. Atualizado em setembro/2026 (última revisão operacional: Boss Only, `admin-users`, retirada de e-mail no produto).

---

## 1. Objetivo e escopo do produto

O **Gerenciador Atende** é uma aplicação web (React + Supabase) para equipes de atendimento do TJSP, focada em:

| Módulo | Função |
|--------|--------|
| **Scripts** | Base de scripts operacionais, versionamento, curadoria, cobertura, exclusão com aprovação |
| **Scripts em Números** | Dashboards de estatísticas de scripts |
| **Escala** | Calendário por equipe (afastamentos, rotinas, agenda institucional) |
| **Pasquale** | Melhoria de texto via IA (DeepSeek) |
| **Links Úteis** | Links da equipe |
| **Outros Serviços** | Registro operacional de serviços |
| **Boss Only** | Administração: setores, equipes, usuários, permissões (sem GSE/anomalias do legado) |
| **Configurações** | Preferências do usuário (tema, etc.) |
| **Notificações** | Modo enxuto: scripts + exclusões pendentes (`scriptsOnly` na Home) |

**Fora do escopo Atende (removidos da Home, não migrados como produto):** Distribuidor/Oráculo, Pastelaria, Radar SMAX, Tarefas v2, Gamificação, Homologação, robôs SMAX, embeddings em produção, GSE.

---

## 2. Origem e estratégia de migração

- **Origem do código:** `C:\Users\david\gerenciador-chamados` → cópia para `C:\Users\david\Atende\gerenciador` com **podagem funcional** (Home, Boss Only, Escala) e **banco curado**.
- **Supabase:** projeto remoto `lhofkimrmzyjazfpqesd` (sem dependência de stack local para o recorte atual).
- **Admin inicial:** `dpestilli@tjsp.jus.br` — role `admin`, lotado na equipe **Atende** (setor/equipe homônimos, `sgs_codigo` `ATENDE`; seed idempotente `20260927240000_seed_equipe_atende_admin.sql`).
- **Banco:**
  - Migrations **ativas** em `supabase/migrations/` (bootstrap Atende + módulos DB-1…DB-6).
  - Histórico completo do monólito em `supabase/migrations_legacy/` (referência; não aplicar em projeto novo).
  - Opcional: `supabase/schema_dump.sql`, `supabase/seed.sql` conforme existirem no repo.

**Princípio:** front = copiar e podar UI/rotas; banco = migrations pequenas e revisadas, não replay cego das 289 legadas.

---

## 3. Cronologia das migrations (Supabase)

| Fase | Arquivo(s) | Conteúdo |
|------|------------|----------|
| DB-1 | `20260926100000_core_bootstrap.sql` + auth/setores/users | Core, setores, equipes, usuários, triggers auth |
| | `20260926101000_auth_gerenciador_contract.sql` | Contrato auth Gerenciador |
| | `20260926102000_auth_is_admin_policies.sql` | Políticas admin |
| | `20260926100500_setores_and_user_fkeys.sql` | FKs usuário/setor |
| | `20260926300000_user_preferences.sql` | Preferências |
| | `20260926310000_usuario_funcoes_equipe.sql` | Funções por equipe |
| | `20260926600000_users_auth_trigger_fix.sql` | Fix signup 500 (trigger `users`) |
| DB-2 | `20260927000000_outros_servicos_db2.sql` | Outros Serviços |
| DB-3 | `20260927100000_links_uteis_db3.sql` | Links Úteis |
| Permissões | `20260926200000_permissoes_objetos_grants.sql`, `20260926201000_permissoes_minhas_codigos.sql` | Modelo de permissões |
| Admin | `20260926400000_admin_boss_setores_equipes.sql`, `20260926401000_admin_atualizar_usuario.sql` | Boss Only / admin |
| Home | `20260926500000_home_cards_gerenciador_atende.sql` | Cards e grants Atende |
| DB-4 | `20260927210000_escala_db4.sql` | Escala (calendários, rotinas, etc.) |
| DB-5 | `20260927220000_scripts_db5_tables.sql`, `20260927221000_scripts_db5_functions.sql` | Tabelas e RPCs de scripts |
| DB-6 | `20260927230000_chamar_deepseek_db6.sql` | RPC `public.chamar_deepseek` |
| Seed | `20260927240000_seed_equipe_atende_admin.sql` | Setor/equipe Atende + lotação/admin `dpestilli@tjsp.jus.br` |
| DB-5b | `20260927250000_scripts_conteudo_usuario_final_categorias.sql` | `tem_conteudo_usuario_final` + tabelas/RPC de categorias para Scripts |

### Comandos úteis

```bash
npx supabase login                                      # uma vez por máquina; token fica no perfil local, não no .env
npx supabase link --project-ref lhofkimrmzyjazfpqesd   # gera vínculo local (não versionar secrets)
npm run sb:push                                         # db push das migrations em supabase/migrations/
npm run sb:deploy-admin-users                           # após alterar supabase/functions/admin-users/
```

### Helpers de montagem DB-5

- `scripts/migracao/extract-scripts-rpcs.mjs` — extrai RPCs do legado.
- `scripts/migracao/assemble-scripts-db5.mjs` — monta partes das migrations de scripts.

### Helpers operacionais (SQL remoto / smoke)

- `scripts/migracao/run-mgmt-sql.mjs` — executa SQL via **Management API** (`PAT_SUPABASE` ou `SUPABASE_ACCESS_TOKEN` no `.env`). Útil quando `supabase db query --linked` falha por privilégio da login role.
- `scripts/migracao/smoke-deepseek.sql` + `run-mgmt-sql.mjs --file=...` — smoke da RPC no Postgres (Vault + extensão `http`).
- `scripts/migracao/smoke-deepseek-auth.mjs` — smoke via PostgREST como usuário (`SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` opcionais no `.env`).

### Atende Stack (Q&A global)

- Plano: `docs/ATENDE_STACK_PLANO.md` — operação/seeds/QA: `docs/ATENDE_STACK_OPERACAO.md`
- Migrations: `supabase/migrations/20260927260000_*.sql` … `20260927269000_*.sql` (`npm run sb:push`)
- Seeds: `npm run stack:seed-demo`, `stack:seed-pag` (+ `:clean`, `:verify` no pag); credenciais smoke no `.env` (modelo `.env.example`)

---

## 4. Problemas encontrados e correções

| Problema | Solução |
|----------|---------|
| Signup/auth 500 | Migration `20260926600000_users_auth_trigger_fix.sql` |
| Constraint duplicada em DB-2 (serviços) | Ajuste na migration de Outros Serviços |
| `sb push` DB-5 falhou por `ALTER` duplicado em `script_notificacoes_tipo_check` | Removido duplicata em `20260927221000_scripts_db5_functions.sql` |
| `npm install` ausente após cópia | `npm install` (~1146 pacotes) |
| TS unused após remover aba GSE no Boss Only | Limpeza em `BossOnlyContent.tsx` / `useBossOnlyModal.ts` |
| DeepSeek no deploy GitHub | Secret `VITE_*` no workflow **não** substitui Vault; Pasquale usa RPC |
| Modelo `deepseek-v4-flash` com `content` vazio | Resposta pode vir em `reasoning_content`; `deepseekService.ts` usa `extractDeepseekText` (igual ao client RPC) |
| Boss Only: formulário “Novo usuário” vinha com login/senha do admin (autofill do navegador) | Campos com `autoComplete` adequado + `readOnly` até foco (`blockUserFormAutofill` em `useBossOnlyModal.ts` / `BossOnlyContent.tsx`) |
| Cadastro de usuário falhava com CORS / “Failed to send a request to the Edge Function” | Função `admin-users` **não estava implantada** no remoto (OPTIONS 404). Implantar com `npm run sb:deploy-admin-users` após `supabase link` |
| `supabase link` avisava versão local do Postgres diferente do remoto | `supabase/config.toml` → `[db] major_version = 17` (remoto Postgres 17) |
| Scripts: `column tem_conteudo_usuario_final does not exist` + 404 em `categorias_equipe` / RPC `obter_hierarquia_categorias` | Migration `20260927250000_scripts_conteudo_usuario_final_categorias.sql` — aplicar com `npm run sb:push`. Tabelas de categorias podem ficar **vazias** até importar dados do legado/produção; filtros funcionam sem 404. |

---

## 5. DeepSeek (Pasquale)

- Front: `melhorarTextoComIA` / ouvidoria → `callDeepseekRpc` → **`public.chamar_deepseek`** (SECURITY DEFINER, `GRANT` para `authenticated`).
- Chave: **`DEEPSEEK_API_KEY` no Supabase Vault** (preferencial); fallback `app.settings.deepseek_api_key`.
- Modelo padrão no client: **`deepseek-v4-flash`** (API responde como `deepseek-flash`); timeout HTTP/SQL **120s**.

Configuração inicial (SQL Editor, service role), se ainda não existir:

```sql
SELECT vault.create_secret(
  '<sua-chave-deepseek>',
  'DEEPSEEK_API_KEY',
  'API key DeepSeek para public.chamar_deepseek'
);
```

**Status set/2026:** Vault `DEEPSEEK_API_KEY` configurado no remoto; smoke SQL e RPC PostgREST OK; **Pasquale validado na UI** pelo operador.

---

## 6. Alterações principais no frontend

### Home (`src/pages/Home.tsx`)

- Home enxuta com cards por **permissão** (`home.card.*`).
- Lazy load apenas dos modais do escopo Atende.
- Pasquale abre `MelhorarTextoModal`; Gerador acoplado aos Scripts.

### Notificações (`NotificationBadge.tsx`)

- Prop **`scriptsOnly`**: desliga menções, tarefas, radar e anomalias de categoria; mantém scripts e exclusões pendentes.
- Home usa `scriptsOnly`.

### Boss Only

- Abas: Setores, Equipes, Usuários, Permissões.
- Removidos GSE e fluxos de anomalias do legado.
- **Criar usuário:** `criarUsuario` → Edge Function **`admin-users`** (`action: create`) via `adminService.ts` — sincroniza Auth + `public.users` (não usar service role no browser).
- **Toggle ativo / reset senha:** também via `admin-users` (`toggle-active`, `reset-password`).
- **Editar perfil/lotação:** RPCs `admin_atualizar_usuario`, `admin_toggle_usuario_ativo` (toggle legado na RPC só atualiza `users`; o fluxo da UI usa ban via Edge Function).
- **Após criar usuário:** modal `UsuarioCriadoModal.tsx` — apenas **copiar credenciais** (clipboard). Texto do bloco: cabeçalho **SISTEMA ATENDE** (não “SGS”). TJSP bloqueia e-mail externo; **não há** envio ZeptoMail/boas-vindas.
- **Config local da function:** `supabase/config.toml` → `[functions.admin-users] verify_jwt = false` (JWT validado dentro da função).

### Scripts (publicação e notificações — sem e-mail)

- **Publicar script:** botão no card → marca coluna legacy `email_enviado = true` + RPC `notificar_curadoria_script_publicado` (sininho). UI usa helper `scriptPublicado()` em `src/types/Script.ts` (não renomear coluna no banco sem migration).
- **Após salvar script novo:** `OrientacaoPosSalvarScriptModal.tsx` (orienta publicar + script para atendente).
- **Curadoria / revisão:** notificações in-app; referência histórica ZeptoMail removida do código (`src/services/emailService.ts` **excluído** do produto Atende).
- **Ajuda in-app:** `ScriptsHelpModal.tsx` — seção **Publicação de Scripts** (`id: publicacao`); fluxo de criação sem menção a envio de e-mail.
- **Exclusão:** `scriptExclusaoService.ts` trata “publicado” via `scriptPublicado()` + `curadoria_atuada`.
- **Renomeações (set/2026):** `EmailPreviewModal` → `UsuarioCriadoModal`; `OrientacaoEmailModal` → `OrientacaoPosSalvarScriptModal`; estado do hook `showOrientacaoPosSalvarModal`.

### Escala

- `isEquipeEscalaCompartilhada()` retorna `false` — um calendário por equipe.
- Títulos genéricos no modal (`EscalaModal.tsx`).

### Build

- `npm run build` validado após ajustes TS.

---

## 7. Permissões (referência rápida)

Definidas em `20260926500000_home_cards_gerenciador_atende.sql`, entre outras:

- `home.card.scripts`, `home.card.escala`, `home.card.pasquale`, `home.card.links_uteis`, `home.card.outros_servicos`, `home.card.configuracoes`
- `scripts.curadoria_acesso`, `scripts.n1_controles`, `scripts.aprovar_exclusao`
- `admin.boss_only_modal` (supervisor/coordenador)

Origem no código: `src/pages/Home.tsx`, hooks de scripts, serviços de exclusão.

---

## 8. Infra e deploy

- **CI:** `.github/workflows/deploy.yml` — build Vite + GitHub Pages (`npm run build`).
- **Pacote npm:** `gerenciador-atende`; **`vite.config.ts` → `base`:** `/gerenciador-scripts/` (repositório GitHub `ProjetoAtende/gerenciador-scripts`).
- **URL pública (Pages):** `https://projetoatende.github.io/gerenciador-scripts/#/home` — links em e-mails usam [`src/config/appUrls.ts`](../src/config/appUrls.ts) (`VITE_APP_PUBLIC_ORIGIN` opcional no build).
- **Remoto Git (referência local):** variável `GITHUB` no `.env` (não versionado) → `https://github.com/ProjetoAtende/gerenciador-scripts`.
- **Push Git:** pacote inicial grande (**HTTP 408**); depois **GH013** por tokens em `archive/legacy/`. Histórico reescrito sem `archive/`; **`archive/`**, dumps e corpo de `migrations_legacy/` no `.gitignore`. Push para `main` concluído com sucesso após limpeza; **Pages** via workflow no push em `main`.
- **Variáveis:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (e opcionais no workflow); `.env` local não versionado. **Não** colocar token da CLI (`supabase login`) nem PAT pessoal no `.env` versionado — só no ambiente de quem opera.
- **Edge Function em uso:** `admin-users` (gestão de usuários via `adminService.ts`). **Implantada no remoto** `lhofkimrmzyjazfpqesd` (set/2026); redeploy com `npm run sb:deploy-admin-users` após mudanças na função. Código: `supabase/functions/admin-users/index.ts`.
- **Postgres remoto:** major version **17** — alinhar `supabase/config.toml` ao linkar (`major_version = 17`).
- **Acesso Supabase:** operadores convidados como **Developer** na org podem `supabase login`, `link` e deploy de functions; **Owner/Admin** convida em Dashboard → Organization → Team. Token da CLI **não** vai para `.env` nem para este documento.
- **E-mail no produto Atende:** não há integração ZeptoMail no front atual; compartilhamento de credenciais de usuário é manual (copiar). Links públicos em mensagens externas podem usar `appUrls.ts` / `VITE_APP_PUBLIC_ORIGIN`.
- **CLI vs Management API:** `supabase login` autentica deploy/link/diff; scripts SQL remoto (`run-mgmt-sql.mjs`) usam `PAT_SUPABASE` ou `SUPABASE_ACCESS_TOKEN` no `.env` — são credenciais distintas.
- **Edge Functions legadas** (não parte do produto Atende): `homologacao-relatorio`, `remote-smax-orchestrator` — arquivadas em `archive/legacy/` se movidas.

---

## 9. Limpeza do repositório (set/2026)

Para separar o **Atende** do monólito **Chamados**:

| Ação | Destino / nota |
|------|----------------|
| Documentação histórica (`docs/` antigo) | `archive/legacy/docs-gerenciador-chamados/` |
| SQL solto (`sql/`) | `archive/legacy/sql-gerenciador-chamados/` |
| Scripts operacionais Oráculo/Distribuidor | `archive/legacy/scripts-gerenciador-chamados/` |
| Scripts de migração Atende | `scripts/migracao/` |
| Lixo raiz (`temp_*.json`, `.codex-*`, `reports/`, `ESTRUTURA_PROJETO.md`) | Removido ou arquivado |
| `supabase/migrations_legacy/` | Referência local (SQL **fora do Git**; só `README.md` versionado) |

### Código-fonte `src/` (poda concluída)

Em set/2026 foi executada poda por **grafo de imports** a partir da Home e dos modais Atende (`scripts/migracao/prune-src.mjs`): **391 arquivos** removidos, **127** mantidos. `NotificationBadge` foi reduzido ao escopo scripts + exclusões pendentes.

Para repetir a análise (dry-run): `node scripts/migracao/prune-src.mjs --dry-run`

---

## 10. Checklist pós-migração

- [x] Migrations DB-1 a DB-6 aplicadas no remoto
- [x] Home e Boss Only recortados
- [x] Escala genérica por equipe
- [x] Build de produção OK
- [x] Vault `DEEPSEEK_API_KEY` + smoke RPC + Pasquale na UI
- [x] Poda completa de `src/` legado (grafo de imports + build OK)
- [x] Renomear pacote npm e alinhar `base` GitHub Pages → `gerenciador-atende`
- [x] Repositório `ProjetoAtende/gerenciador-scripts` publicado (`main` + GitHub Pages)
- [x] Equipe **Atende** e admin inicial no Supabase remoto
- [x] Edge Function **`admin-users`** implantada no remoto (cadastro/toggle/reset via Boss Only)
- [x] Boss Only: autofill corrigido; pós-criação só **Copiar credenciais** (`UsuarioCriadoModal`, marca **Sistema Atende**)
- [x] Scripts: fluxo documentado e UI alinhada à **publicação + sininho** (sem `emailService.ts`)

---

## 11. Artefatos legados — **não executar**

Esta seção existe para evitar que, no futuro, alguém aplique por engano SQL ou scripts do monólito **Gerenciador de Chamados** no ambiente **Gerenciador Atende**.

### `supabase/migrations/` (✅ usar)

- Única pasta que o **`supabase db push`** deve aplicar no projeto remoto Atende.
- Contém o recorte curado (DB-1…DB-6 e permissões).

### `supabase/migrations_legacy/` (⛔ só leitura)

- ~289 migrations do histórico completo do Chamados (Oráculo, Distribuidor, Radar, Tarefas, etc.).
- **Não** copiar arquivos daqui para `migrations/` e dar push.
- **Não** colar estes SQLs no SQL Editor de produção “para alinhar” o banco.
- O CLI **não** aplica esta pasta automaticamente; o risco é operação manual ou script improvisado.
- README dedicado: [`supabase/migrations_legacy/README.md`](../supabase/migrations_legacy/README.md).

### `archive/legacy/` (⛔ arquivo morto, local)

- Documentação, SQL solto, scripts TS, Edge Functions e relatórios do projeto anterior.
- **Não** entra no repositório GitHub (contém tokens em scripts/docs antigos); copie do backup local ou do monólito `gerenciador-chamados` se precisar.
- **Não** rodar scripts daqui contra o Supabase Atende sem revisão formal.
- Muitos scripts referenciam Docker `supabase_db_gerenciador-chamados` e paths antigos — podem importar dados, alterar schema ou falhar de forma perigosa.
- README dedicado: [`archive/legacy/README.md`](../archive/legacy/README.md).

### Sinais de que algo errado está sendo executado

| Sintoma | Provável causa |
|---------|----------------|
| `db push` tentando centenas de migrations | Arquivos legados copiados para `supabase/migrations/` |
| Reaparecem tabelas `radar_*`, `tickets`, oráculo | SQL legado aplicado no remoto |
| Script pede container `gerenciador-chamados` | Script em `archive/legacy/scripts-gerenciador-chamados/` |
| Vitest falha em `archive/**` | Não executar testes arquivados; o projeto exclui `archive/` no `vite.config.ts` |

### Regra prática

> **Produção Atende = apenas `supabase/migrations/` + código em `src/` + Edge Function `admin-users`.**  
> Tudo em `migrations_legacy/` e `archive/legacy/` é **museu**, não pipeline.

---

## 12. Contatos e decisões

- Produto: **Gerenciador Atende** — ferramenta interna (Scripts + operação diária).
- Banco único Supabase remoto; sem replicação automática do legado Chamados.
- Documentação histórica (somente leitura): `archive/legacy/docs-gerenciador-chamados/`.

---

*Este arquivo substitui notas dispersas da migração e deve ser atualizado a cada fase relevante (banco, escopo Home, infra IA).*
