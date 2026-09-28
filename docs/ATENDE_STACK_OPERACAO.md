# Atende Stack — operação, QA e seeds

Complemento ao [plano funcional](./ATENDE_STACK_PLANO.md). Relatórios detalhados de QA (GrokBot) ficam em `reports/` (pasta local, não versionada).

**Última atualização:** 2026-09-28

**Versão de produto:** **v1** (backend + funcionalidades core) · **v2** (UX do detalhe e compositor — ver seção abaixo).

---

## Atende Stack v2 (2026-09-28)

Melhorias de **experiência no painel de detalhe** da pergunta (sem migrations nem mudança de RPC). Objetivo: respostas curtas rápidas, textos longos confortáveis e thread legível.

### Layout do detalhe

| Zona | Comportamento | Visual |
|------|----------------|--------|
| **Cabeçalho** | Título, tags, status, ações (joinha, favorito, editar, fechar, excluir) | Fixo no topo do painel |
| **Pergunta** | Corpo HTML, bloco de reabertura, metadados de edição | Card fixo (**não rola** com as respostas); borda neutra forte |
| **Compositor** | Resposta curta + botões | Card **indigo** abaixo da pergunta; fixo enquanto a thread rola |
| **Respostas publicadas** | Lista com ações (joinha, solução, editar) | Fundo mais neutro; **única área com scroll vertical** |

Pergunta encerrada: compositor oculto; barra “Pergunta encerrada” + reabrir (staff) permanecem.

### Responder (dois modos, um rascunho)

1. **Resposta curta (inline)** — `StackMinimalReplyEditor`: textarea multilinha (auto-grow ~3–8 linhas), converte texto plano em HTML simples (`<p>` por linha). Botão **Publicar resposta**.
2. **Editor completo** — modal **80vh** (`StackFullEditorModal`):
   - **~55%** esquerda/topo: `StackRichTextEditor` (mesmo rich text da v1, sem IA).
   - **~45%** direita/base: pergunta (sticky) + respostas com scroll interno (somente leitura).
   - **Publicar**, **Voltar** (mantém rascunho), **Esc** fecha o modal.
   - Em viewports estreitas: coluna (editor acima, contexto abaixo).

**Rascunho único:** estado `respostaDraft` compartilhado entre inline e modal. Trocar de pergunta na lista **limpa** rascunho e fecha o modal. HTML com formatação avançada ou mídia no rascunho: o inline exibe aviso para continuar no editor completo (`isStackMinimalCompatibleHtml`).

Utilitários: `src/utils/stackReplyDraftUtils.ts` (`plainTextToStackReplyHtml`, `stackReplyHtmlToPlainText`, `isStackMinimalCompatibleHtml`).

### Respostas longas na thread

`StackCollapsibleHtmlViewer`: respostas **intermediárias** longas exibem **uma linha** + **Ver mais** / **Ver menos**. **Não colapsa** se for a **única** resposta do thread ou a **última** (sempre texto completo). Usado no detalhe e no painel de contexto do editor completo. A pergunta no detalhe continua **sempre expandida**.

### Componentes (v2)

| Arquivo | Função |
|---------|--------|
| `StackMinimalReplyEditor.tsx` | Compositor curto |
| `StackFullEditorModal.tsx` | Modal editor completo + contexto |
| `StackCollapsibleHtmlViewer.tsx` | Colapso de respostas longas |
| `RichTextEditor.tsx` | Prop `fillHeight` (modal Stack) |

Orquestração: `AtendeStackModal.tsx` (removido compositor fixo no rodapé com `max-h-48`).

### QA manual sugerido (v2)

- [ ] Resposta curta inline publica e limpa rascunho.
- [ ] Texto digitado no inline aparece no editor completo ao abrir o modal.
- [ ] Formatação rica no modal: aviso no inline; publicar pelo modal.
- [ ] Scroll só na lista de respostas; pergunta e compositor visíveis ao rolar.
- [ ] Resposta longa **intermediária** (não é a última): uma linha + Ver mais / Ver menos.
- [ ] Única resposta longa ou **última** do thread: texto completo, sem colapso.
- [ ] Esc fecha modal completo sem fechar o Stack; Esc com rascunho pergunta confirmação (comportamento v1).
- [ ] Trocar pergunta descarta rascunho de resposta.

---

## Migrations (Supabase)

Aplicar na ordem com `npm run sb:push` ou pipeline habitual:

| Arquivo | Conteúdo resumido |
|---------|-------------------|
| `20260927260000_atende_stack_tables.sql` | Tabelas, RLS, índices FTS |
| `20260927261000_atende_stack_functions.sql` | RPCs feed, busca, CRUD, notificações |
| `20260927262000_stack_buscar_offset.sql` | Busca paginada (offset) |
| `20260927263000_atende_stack_qa_fixes.sql` | QA rodada 1–2: XSS, REVOKE, unaccent, votos, notificações |
| `20260927264000_stack_pagination_busca_group.sql` | Cursor feed alinhado |
| `20260927265000_stack_buscar_cursor_grouped.sql` | Busca agrupada + cursor `(score, pergunta_id)` |
| `20260927266000_stack_simulacao_preview_role.sql` | `p_preview_role` em leitura |
| `20260927267000_stack_qa_rodada4_retest.sql` | Reteste R3: votar, buscar, `stack_obter_pergunta` |
| `20260927268000_stack_html_assert_entities_data.sql` | Decode entidades + bloqueio `data:` |
| `20260927269000_stack_qa_rodada8_html_equipe.sql` | Allowlist URL em `href`/`src`, `stack_autor_equipe_efetiva` (BUG-33) |
| `20260927270000_stack_autor_self_visible.sql` | User vê **próprio** nome no payload `autor`; demais users continuam anônimos |
| `20260928120000_stack_tags_ia.sql` | Tags IA assíncronas (`stack_tag_jobs`), filtro AND, nuvem, fallback «Sem classificação», staff |
| `20260928130000_stack_tag_jobs_cron.sql` | Worker em lote (`stack_processar_tag_jobs_batch`), pg_cron */2 min |
| `20260928140000_stack_tags_ia_security.sql` | REVOKE helpers (TIA-B1), caller batch/cron (TIA-B2), fallback autocurativo (TIA-B3), rate limit 30/h (TIA-B4), rótulo IA ≤40 chars |

### Tags IA — produção (projeto linkado)

**Estado (2026-09-28):** migrations aplicadas no remoto; **DeepSeek (Vault)** ok; **pg_cron** habilitado com job ativo abaixo. **Não é necessário** configurar `STACK_TAG_CRON_SECRET` nem cron HTTP na Edge Function para operação normal.

| Camada | Função |
|--------|--------|
| **W3 (app)** | Após criar pergunta ou editar **corpo**, o modal chama `stack_processar_tag_job` (best-effort). |
| **W1 (pg_cron)** | Job SQL a cada 2 min processa até 2 jobs pendentes. |
| **Edge Function** | `stack-process-tag-jobs` deployada; **opcional** (backup ou automação externa). |

**Pré-requisitos**

- Extensão **pg_cron** enabled (Database → Extensions).
- Vault **`DEEPSEEK_API_KEY`** (mesma RPC `chamar_deepseek` do Pasquale).
- Seed demo: conta **staff** + `stack_staff_definir_tags` após create (`npm run stack:seed-demo`).

**Verificar job pg_cron (SQL Editor)**

```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'stack_processar_tag_jobs';
```

Esperado: uma linha, `schedule` = `*/2 * * * *`, `command` = `SELECT public.stack_processar_tag_jobs_batch(2);`, `active` = true.

**Fila / jobs recentes (diagnóstico)**

```sql
SELECT id, pergunta_id, status, motivo, tentativas, ultimo_erro, created_at, finished_at
FROM public.stack_tag_jobs
ORDER BY created_at DESC
LIMIT 20;
```

**Smoke worker (local, service role no `.env`)**

```bash
npm run stack:process-tag-jobs
```

Chama `stack_processar_tag_jobs_batch` via RPC (não exige secret).

### Worker HTTP opcional (Edge Function)

Só use se quiser cron **fora** do pg_cron (GitHub Action, etc.):

1. Secret **`STACK_TAG_CRON_SECRET`** na function `stack-process-tag-jobs`.
2. **POST** com header `x-stack-cron-secret: <mesmo valor>`.
3. Deploy: `npm run sb:deploy-stack-tag-worker`.

Com pg_cron ativo, este caminho é **redundante**.

---

## Autoria e publicação no detalhe

No painel de **detalhe** (pergunta e cada resposta):

| Quem vê | Linha exibida |
|---------|----------------|
| `user` (conteúdo alheio) | `por anônimo em dd/mm/aa hh:mm` |
| `user` (próprio conteúdo) | `por {nome do perfil} em dd/mm/aa hh:mm` |
| staff | Nome real + `· email` após a linha; demais users anônimos |

- Data/hora = `created_at` (publicação), formato **`27/09/26 15:40`** (local do navegador).
- Edição continua em linha separada: **Editado em …** (data/hora completa `pt-BR`), quando existir.
- Helpers: `stackPublicadoPorLine`, `formatStackDateTime` em `src/components/atende-stack/stackUtils.ts`.
- RPC: `stack_autor_json` / `stack_autor_json_for_view` (migration 270000).

---

## Variáveis de ambiente (testes locais)

No `.env` (nunca commitar). Modelo em `.env.example`.

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Cliente do app e scripts Node |
| `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD` | Conta **staff/admin** — seed paginação, demo, `--clean` via `stack_deletar` |
| `SMOKE_TEST_USER_EMAIL`, `SMOKE_TEST_USER_PASSWORD` | Conta **user** opcional — réplicas/tréplicas no seed demo |
| `SMOKE_TEST_USER2_EMAIL`, `SMOKE_TEST_USER2_PASSWORD` | Reservado (terceira conta; scripts atuais não usam) |

---

## Scripts npm — seeds e verificação

### Paginação (F-02 QA)

```bash
npm run stack:seed-pag              # 45 perguntas [TESTE PAG]
npm run stack:seed-pag:verify       # confere 40+5 sem duplicatas
npm run stack:seed-pag:clean        # remove via stack_deletar (staff)
```

Script: `scripts/atende-stack-seed-paginacao.mjs`  
Prefixo de título: **`[TESTE PAG]`**

### Demonstração (conteúdo rico)

```bash
npm run stack:seed-demo             # 12 perguntas + 17 respostas variadas
npm run stack:seed-demo:list        # lista IDs no feed
npm run stack:seed-demo:clean       # exclusão em massa (staff)
npm run stack:seed-demo:clean-tags  # remove tags teste-demo, demo-stack e QA (service role)
```

Script: `scripts/atende-stack-seed-demo.mjs`

| Marca | Valor |
|-------|--------|
| Prefixo do título | **`[TESTE DEMO]`** |
| Tags | `teste-demo`, `demo-stack` (um caso) |
| Marcador HTML | `teste-demo-seed-v1` (busca auxiliar) |

**Cenários incluídos:** texto e listas; links https/mailto/relativos; imagens HTTPS (picsum); riscado e `text-align`; precatórios/acentos (busca); blockquote/código; threads com até 3 respostas (réplica + tréplicas); pergunta sem resposta.

Com `SMOKE_TEST_USER_*` definido, a pergunta “Thread longa” usa a 2ª conta na 2ª e 3ª resposta.

### Simulação de papel (admin)

```bash
node scripts/atende-stack-verify-simulacao.mjs --pergunta=<uuid>
```

Requer `SMOKE_TEST_*` admin e um id de pergunta existente.

---

## Frontend (referência rápida)

| Área | Caminhos |
|------|----------|
| Modal e UI | `src/components/atende-stack/` |
| Compositor v2 | `StackMinimalReplyEditor`, `StackFullEditorModal`, `stackReplyDraftUtils.ts` |
| Colapso respostas | `StackCollapsibleHtmlViewer.tsx` |
| Feed / busca | `src/hooks/useAtendeStackFeed.ts` |
| RPC | `src/services/atendeStackService.ts` |
| Tipos | `src/types/atendeStack.ts` |
| Sanitização | `src/utils/sanitizeStackHtml.ts`, `sanitizeHighlightHtml.ts` |
| Destaque busca (acentos) | `src/utils/stackSearchHighlight.ts` |
| Byline autoria/data | `src/components/atende-stack/stackUtils.ts` (`stackPublicadoPorLine`) |
| Home / deep link | `src/pages/Home.tsx` |

---

## Histórico QA (resumo)

Correções implementadas em ondas (migrations + frontend), validadas pelo GrokBot em set/2026:

- **Rodadas 1–2:** críticos/altos (XSS, FTS unaccent, REVOKE, paginação feed).
- **Rodada 3–6:** retestes; BUG-30 busca; BUG-27 mídia no viewer; parciais M-05/L-03/SV-01.
- **Rodada 7:** highlight de busca no cliente; touch 44px ampliado; decode HTML no servidor.
- **Rodada 8:** allowlist de URLs no SQL; validação `autor_equipe_id`; últimos alvos WCAG no composer.

Estado após rodada 7 (reteste GrokBot): **30 bugs corrigidos**, parciais **BUG-13** e **BUG-28**, aberto **BUG-33** (endereçado na migration 269000). Relatório completo: pasta `reports/atende-stack-teste-2026-09-27/` (local).

---

## Limpeza de dados de teste

1. Preferir `npm run stack:seed-demo:clean` e `npm run stack:seed-pag:clean` (conta staff).
2. Busca no app: `[TESTE DEMO]`, `[TESTE PAG]`, ou tags `teste-demo` / `teste-canonico` (QA antigo).
3. Não usar DELETE direto no banco salvo em manutenção com RLS desligado.
