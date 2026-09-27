# Atende Stack — operação, QA e seeds

Complemento ao [plano funcional](./ATENDE_STACK_PLANO.md). Relatórios detalhados de QA (GrokBot) ficam em `reports/` (pasta local, não versionada).

**Última atualização:** 2026-09-27

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
| Feed / busca | `src/hooks/useAtendeStackFeed.ts` |
| RPC | `src/services/atendeStackService.ts` |
| Tipos | `src/types/atendeStack.ts` |
| Sanitização | `src/utils/sanitizeStackHtml.ts`, `sanitizeHighlightHtml.ts` |
| Destaque busca (acentos) | `src/utils/stackSearchHighlight.ts` |
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
