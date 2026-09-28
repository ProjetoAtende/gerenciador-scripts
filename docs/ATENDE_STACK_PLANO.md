# Plano de implementação — Atende Stack (v1)

Documento executável por fases: regras de negócio, backend (Supabase), frontend (UX), notificações e critérios de aceite.

**Repositório:** Gerenciador Atende  
**Última atualização:** 2026-09-28

**Status implementação (frontend v1):** concluído — ver seção 11 do plano + filtros por tag, paginação feed/busca, skeletons, help, atalhos, FAB mobile, `StackRichTextEditor` sem IA, snippets sanitizados (DOMPurify).

**Status implementação (frontend v2):** concluído — ver **seção 15** (detalhe: compositor mínimo, editor completo em modal, thread colapsável).

**Operação, seeds e QA:** [ATENDE_STACK_OPERACAO.md](./ATENDE_STACK_OPERACAO.md) (inclui **Atende Stack v2**)

---

## 1. Objetivo e visão

**Atende Stack** é um Q&A global, estilo Stack Overflow interno, acessado por card na Home. O clique abre modal **fullscreen**. Usuários fazem perguntas (com título) e respondem **sem identificação visível para pares** (perfil `user`); staff vê autoria para auditoria e moderação.

**Competência:** dúvidas sobre operação Atende, scripts, fluxos e ferramentas da equipe.

**Princípios de produto:**

- Global (todos autenticados veem o card e usam o módulo).
- Anonimato para `user`; transparência para `supervisor`, `coordenador`, `admin`.
- Busca por palavras-chave (FTS estilo Oráculo: ranking + highlight).
- Tags canônicas (sem variações ortográficas duplicadas).
- Resposta marcada como **Solução** fecha a pergunta automaticamente.
- Reabertura apenas por staff, com motivo obrigatório exibido em bloco distinto.

---

## 2. Princípios UX (frontend)

Aplicar em todo o `AtendeStackModal`:

| Princípio | Implementação |
|-----------|----------------|
| Viewport único | Modal `100dvh`, `overflow-hidden` no shell; scroll **somente** em painéis internos (`min-h-0`, `flex-1`, `overflow-y-auto`). |
| Hierarquia | Uma ação primária por contexto; demais em menu `⋯` ou toolbar compacta. |
| Densidade | Lista compacta (título + meta em uma linha); detalhe legível sem grandes vazios. |
| Feedback | Skeleton na lista; optimistic UI em joinha/favorito; toasts discretos (sonner); empty/error states claros. |
| Acessibilidade | Foco visível; `aria-label` em ícones; contraste WCAG AA; alvos ≥ 44px no mobile. |
| Consistência | Padrão header fullscreen alinhado a Outros Serviços; identidade visual **indigo/violet** (distinta dos outros cards). |
| Mobile | Master-detail → navegação Stack \| Detalhe; filtros em bottom sheet. |
| Scroll lock | Enquanto modal aberto: `document.body.style.overflow = 'hidden'`. |

**Rich text (decisão de implementação):** **não refatorar** o editor dos Scripts em módulo compartilhado na v1. **Copiar/adaptar** `RichTextEditor` para preset enxuto do Stack (sem variáveis `{[]}`, `()`, IA de script). Objetivo: facilitar, não complicar.

---

## 3. Regras de negócio (referência única)

| Tema | Regra |
|------|--------|
| Escopo | Global |
| Card Home | Visível para **todos autenticados** |
| Anonimato | `user` não vê autor alheio (exibe **anônimo**); vê **próprio nome** no próprio conteúdo; `supervisor+` vê **nome + e-mail** |
| Ordenação feed | **Sem bump.** `ultima_atividade_em DESC`, `upvote_count DESC`, `created_at DESC` |
| `ultima_atividade_em` | Atualizado em: nova resposta, aceite, edição relevante, fechamento, reabertura |
| Resolução | Autor **ou** staff marca resposta como solução |
| Ao aceitar solução | `resposta_aceita_id` preenchido + `status = fechada` **automaticamente** |
| Reabrir | Só **staff**; **limpa** `resposta_aceita_id`; motivo **obrigatório**; motivo persistido e exibido em bloco **“Reabertura pela equipe”** (texto distinto do corpo da pergunta) |
| Fechar manual | Staff pode fechar sem aceite (complementar ao fluxo de aceite) |
| Edição | Autor edita próprio conteúdo; staff edita qualquer; **visível** (“Editado em …”); staff vê **quem** editou |
| Exclusão | **Hard delete** apenas staff (confirmação forte) |
| Tags | Primeiro uso cria tag **canônica** (`slug` normalizado); autocomplete depois; **sem limite** por pergunta |
| Joinha | Pergunta **e** resposta; toggle 1 voto/usuário/alvo |
| Filtros | Combináveis (AND); Abertas/Fechadas **mutuamente exclusivos** |
| Filtro equipe | Select secundário: **Todas \| Criadas pela equipe \| Com resposta da equipe**; **desabilitado** se usuário sem `equipe_id` |
| Notificações | Agregação onde aplicável; **nunca** identificar quem respondeu/joinhou/etc. |
| Edição de pergunta (notif.) | Apenas **autor da pergunta** e quem **favoritou** |
| Vínculo script/ticket | Fora do v1 |

---

## 4. Modelo de dados

### 4.1 Tabelas

#### `stack_perguntas`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `titulo` | text | ≤ 200 chars |
| `corpo_html` | text | Rich text |
| `corpo_plain` | text | FTS + preview |
| `autor_id` | uuid FK users | Sempre persistido |
| `autor_equipe_id` | uuid nullable | Snapshot na criação |
| `status` | text | `aberta`, `fechada`, `oculta` |
| `resposta_aceita_id` | uuid nullable FK | Limpo na reabertura |
| `upvote_count` | int | Desnormalizado |
| `resposta_count` | int | Desnormalizado |
| `ultima_atividade_em` | timestamptz | Ordenação feed |
| `editado_em` | timestamptz nullable | |
| `editado_por_id` | uuid nullable | |
| `search_vector` | tsvector | título + plain + tags |
| `created_at`, `updated_at` | timestamptz | |

#### `stack_respostas`

| Coluna | Tipo |
|--------|------|
| `id` | uuid PK |
| `pergunta_id` | uuid FK |
| `corpo_html`, `corpo_plain` | text |
| `autor_id`, `autor_equipe_id` | uuid |
| `upvote_count` | int |
| `editado_em`, `editado_por_id` | nullable |
| `created_at`, `updated_at` | timestamptz |

#### `stack_votes`

- `user_id`, `alvo_tipo` (`pergunta` \| `resposta`), `alvo_id`, `created_at`
- UNIQUE `(user_id, alvo_tipo, alvo_id)`

#### `stack_tags`

- `id`, `slug` UNIQUE, `rotulo`, `created_at`

#### `stack_pergunta_tags`

- PK `(pergunta_id, tag_id)`

#### `stack_favoritos`

- PK `(user_id, pergunta_id)`, `created_at`

#### `stack_reaberturas`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `pergunta_id` | uuid FK | |
| `staff_id` | uuid FK | |
| `motivo` | text | Plain text (quebras preservadas) |
| `created_at` | timestamptz | |

UI v1: exibir registro **mais recente** no detalhe; histórico completo opcional v1.1.

#### `stack_notificacoes`

- `id`, `user_id`, `pergunta_id`, `tipo`, `contador` (agregação), `mensagem`, `lida_em`, `created_at`, `updated_at`
- Upsert lógico por `(user_id, pergunta_id, tipo)` na janela de agregação (~15 min)

### 4.2 Funções SQL auxiliares

- `stack_tag_slug(text) → text` — `unaccent`, lower, normalização, hífens (ex.: Precatório / precatorios → `precatorios`)
- Sincronização `corpo_plain` a partir de HTML na RPC de escrita
- `stack_atualizar_search_vector(pergunta_id)`

### 4.3 Triggers

- Resposta insert/delete → `resposta_count`, `ultima_atividade_em`
- Voto → `upvote_count`
- Aceite, fechar, reabrir, edit → `ultima_atividade_em`

### 4.4 Segurança

- Preferir **RPCs `SECURITY DEFINER`** para leitura/escrita; cliente não faz SELECT direto que exponha `autor_id` a roles inadequados.
- RLS: autenticados; writes validados nas RPCs.

### 4.5 Payload de autoria (API)

```typescript
// Perfil user — conteúdo de outro
autor: { anonimo: true }

// Perfil user — próprio conteúdo (viewer = autor_id)
autor: { id, nome, email }

// Perfil supervisor+
autor: { id, nome, email }
editado_por: { editado_em, por?: … } // por só identificado para staff
```

**UI (detalhe):** linha `por {nome|anônimo} em dd/mm/aa hh:mm` a partir de `created_at`; staff pode ver e-mail após a linha. Edição mantém bloco **Editado em …** separado.

---

## 5. RPCs (contrato)

| RPC | Descrição |
|-----|-----------|
| `stack_listar_feed` | Filtros JSON + cursor + limit; lista enxuta com máscara de autoria |
| `stack_obter_pergunta` | Detalhe, tags, reabertura recente, respostas (aceita primeiro), favorito/votos do usuário |
| `stack_buscar` | FTS + escopo + filtros; highlight; ordenação por relevância |
| `stack_criar_pergunta` | título, html, tags (ids ou novos rótulos) |
| `stack_editar_pergunta` | autor ou staff; notifica autor + favoritos se conteúdo mudou |
| `stack_criar_resposta` | só se `aberta` |
| `stack_editar_resposta` | autor ou staff |
| `stack_votar` | toggle joinha |
| `stack_favoritar` | toggle |
| `stack_marcar_aceita` | autor ou staff → aceite + fechada |
| `stack_reabrir` | staff + motivo obrigatório → limpa aceite, aberta, insert reabertura |
| `stack_fechar` | staff |
| `stack_deletar` | staff hard delete (cascade) |
| `stack_listar_tags` | autocomplete |
| `stack_listar_notificacoes` | sininho |
| `stack_marcar_notificacao_lida` | |

### 5.1 Filtros (`stack_listar_feed` / `stack_buscar`)

JSON sugerido:

```json
{
  "minhas": { "fiz": false, "respondi": false, "favoritas": false },
  "status": "todas | aberta | fechada",
  "equipe": {
    "ativo": false,
    "modo": "todas | criadas | com_resposta"
  },
  "tag_ids": ["uuid"]
}
```

- **Criadas pela equipe:** `autor_equipe_id = equipe_atual`
- **Com resposta da equipe:** EXISTS resposta com `autor_equipe_id = equipe_atual`
- Combinação: AND entre grupos ativos

---

## 6. Busca FTS

Inspirada em `oraculo_search_fts_highlighted` (Gerenciador / Oráculo):

- Config `portuguese`
- Query: `websearch_to_tsquery` ou `plainto_tsquery` (alinhar ao padrão Oráculo do projeto)
- Pesos: **título** > **tags** > corpo da pergunta
- Escopos: **perguntas**, **respostas**, **ambos**
- Ranking: `ts_rank_cd`; highlight: `ts_headline` com `<mark>`
- Cliente: sanitizar HTML (DOMPurify; permitir `mark` e tags de leitura)
- Busca respeita **filtros ativos** (FTS no subconjunto)

---

## 7. Notificações

### 7.1 Tipos

| Tipo | Destinatário | Agregação (~15 min) |
|------|--------------|---------------------|
| Nova resposta | Autor da pergunta | Sim |
| Joinha na pergunta | Autor da pergunta | Sim |
| Joinha na resposta | Autor da resposta | Sim |
| Resposta aceita (solução) | Autor da resposta aceita | Não |
| Pergunta fechada | Autor + favoritos | Não |
| Pergunta reaberta | Autor + favoritos | Não (sininho curto; motivo longo só no detalhe) |
| Pergunta editada | **Autor + favoritos** | Preferir 1 notif por janela (“Pergunta atualizada”) |
| Conteúdo removido (staff) | Autor afetado | Não |

**Regra:** mensagens **nunca** incluem nome/e-mail de quem agiu.

### 7.2 UI

- Integrar ao sininho existente (`NotificationBadge`): seção ou itens **Atende Stack**
- Deep link: `/home?modal=atendeStack&pergunta=<uuid>`

---

## 8. Especificação UX — `AtendeStackModal`

### 8.1 Estrutura (desktop)

```
fixed inset-0 z-[9999] flex flex-col bg-slate-50 dark:bg-slate-950
├── Header (h-14, shrink-0) — título, ?, fechar
├── Toolbar (h-12) — busca + Perguntas|Respostas|Ambos + Nova pergunta
└── Body (flex-1 min-h-0)
    ├── Filtros (w-56, md+)
    ├── Lista (~38%, scroll)
    └── Detalhe (flex-1, scroll + rodapé composer se aberta)
```

**Paleta:** primária `indigo-600`; joinha `amber-500`; solução `emerald-600`; reabertura staff `amber-600` + borda lateral.

### 8.2 Filtros (coluna / sheet)

1. Equipe — checkbox habilita select (Todas / Criadas / Com resposta); disabled + tooltip sem equipe
2. Minhas — toggles: Fiz | Respondi | Favoritas
3. Status — radio: Todas | Abertas | Fechadas
4. Tags — multiselect autocomplete
5. Limpar filtros

### 8.3 Lista

- Título (2 linhas max), meta: joinhas, respostas, status pill, tags
- Favorito (estrela), seleção (borda indigo)
- Paginação: cursor ou infinite scroll

### 8.4 Detalhe

1. Cabeçalho: título, tags, joinha, favorito, menu editar
2. Corpo rich (viewer)
3. **Bloco reabertura** (se houver): fundo/borda distintos, rótulo **“Reabertura pela equipe”**, motivo, data; staff vê quem reabriu
4. Linha “Editado …” (staff vê editor)
5. Respostas: aceita no topo (**Solução**), depois joinhas, depois data
6. Rodapé: editor rich + Publicar (se aberta); banner “Encerrada” se fechada; staff: **Reabrir**

### 8.5 Modal Reabrir (staff)

- Textarea motivo (obrigatório)
- Aviso: solução será desmarcada
- Cancelar | Reabrir

### 8.6 Mobile

- Tabs Stack | Detalhe
- Filtros → bottom sheet
- FAB nova pergunta

### 8.7 Atalhos

- `Esc` fecha modal (se não houver submodal aberto)
- `/` foca busca (opcional fase polish)

---

## 9. Integração Home

Arquivo: `src/pages/Home.tsx`

- Adicionar `atendeStack` em `HOME_MODALS`
- Card **Atende Stack** (gradiente indigo/violet, emoji 🗨)
- Sem restrição de permissão (todos autenticados)
- Lazy load: `AtendeStackModal.tsx`
- Query: `?modal=atendeStack&pergunta=<uuid>`

---

## 10. Fases de implementação

### Fase 0 — Preparação (~0,5 dia)

- Confirmar extensão `unaccent` no Supabase
- Branch feature
- **Aceite:** lista de RPCs e escopo UX acordados (este documento)

### Fase 1 — Fundação de dados (1,5–2 dias)

- Migration: tabelas, índices, GIN FTS, triggers
- RPCs: `stack_listar_feed`, `stack_obter_pergunta`, `stack_listar_tags`, `stack_criar_pergunta`, `stack_criar_resposta`
- **Aceite:** feed ordena por atividade; anonimato em JSON por role

### Fase 2 — Shell UX + feed (2 dias)

- Card + modal layout (seções 8.1–8.3)
- Filtros combináveis + select equipe
- Hook feed + detalhe leitura (viewer sanitizado)
- **Aceite:** modal viewport-safe; filtros AND funcionando

### Fase 3 — Interações sociais (1,5–2 dias)

- Joinha, favoritos, tags, nova/editar pergunta e resposta (rich copiado)
- Marcar solução + auto-fechar
- **Aceite:** fluxo solução + UI edição visível

### Fase 4 — Staff e reabertura (1 dia)

- `stack_reabrir`, modal motivo, bloco reabertura no detalhe
- Hard delete staff
- **Aceite:** aceite limpo; motivo visível e distinto

### Fase 5 — Busca FTS (1–1,5 dia)

- `stack_buscar` + UI snippets highlight
- **Aceite:** escopos e filtros + rank/highlight

### Fase 6 — Notificações (1,5 dia)

- Tabela, agregação, sininho, deep link
- Edição pergunta → autor + favoritos
- **Aceite:** textos sem autoria de terceiros; agregação joinhas/respostas

### Fase 7 — Polish UX (1–1,5 dia)

- Skeletons, empty/error, dark mode, help (?)
- Teste simulação de role na Home
- **Aceite:** checklist seção 2 cumprida

**Estimativa total:** ~9–11 dias (1 dev fullstack familiar com o repo).

### Dependências

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 7
Fase 1 → Fase 5 → Fase 7
Fase 3 → Fase 6 → Fase 7
Fase 4 → Fase 6
```

---

## 11. Definition of Done (v1)

- [ ] Card Atende Stack na Home (usuário autenticado)
- [ ] Modal fullscreen sem scroll da página
- [ ] Filtros combináveis + equipe (3 modos, disabled sem equipe)
- [ ] Perguntas/respostas rich text; tags canônicas; favoritos; joinhas
- [ ] Solução + fechamento automático
- [ ] Reabertura staff: limpa aceite + motivo em bloco dedicado
- [ ] Busca FTS com highlight
- [ ] Anonimato `user` vs identidade staff
- [ ] Notificações agregadas + sininho + deep link
- [ ] Edição visível; staff vê quem editou

---

## 12. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Duplicação RichTextEditor | Arquivo dedicado Stack; refator compartilhado só pós-v1 |
| FTS em HTML | Sempre manter `corpo_plain` na escrita |
| Hard delete | Confirmação dupla; cascade explícito |
| Spam notificação | Agregação 15 min; edição só autor + favoritos |
| Feed lento | Índice `(status, ultima_atividade_em DESC)` + paginação |

---

## 13. Backlog pós-v1

- Vínculo pergunta ↔ script / ticket
- Histórico UI de todas as reaberturas
- Sugestão “perguntas similares” ao criar (FTS)
- Trigram opcional para typos
- Refator editor rich text compartilhado (se duplicação incomodar)
- Colapso “Ver mais” na **lista/feed** (hoje só no detalhe — v2)
- Toolbar enxuta dedicada ao compositor mínimo (v2 usa textarea plana)

---

## 15. Atende Stack v2 — detalhe e compositor (2026-09-28)

Evolução **somente frontend** do painel de detalhe. Backend, RPCs e regras da seção 3 permanecem as da v1.

### Problema endereçado

O compositor de resposta no **rodapé**, com editor rich text completo limitado a ~192px (`max-h-48`), consumia espaço com a toolbar e dificultava respostas longas. Pergunta e respostas rolavam juntas, perdendo contexto do enunciado.

### Decisões UX (v2)

| Tema | Decisão |
|------|---------|
| Hierarquia visual | Três superfícies distintas: **pergunta** (neutra), **compositor** (indigo/ativo), **thread** (fundo neutro, scroll) |
| Scroll | Pergunta + compositor **fixos**; scroll **apenas** em respostas publicadas |
| Resposta curta | Textarea mínima inline; HTML simples gerado no cliente |
| Resposta longa / rica | Botão **Editor completo** → modal 80vh, split ~55% editor / ~45% contexto |
| Rascunho | Um único `respostaDraft` para inline e modal |
| Leitura | Respostas **intermediárias** longas: **1 linha** + **Ver mais** / **Ver menos**; **única** ou **última** resposta sempre expandida |

### Critérios de aceite (v2)

- [x] Compositor mínimo abaixo da pergunta; sem editor rich no rodapé
- [x] Modal editor completo com contexto (pergunta + respostas roláveis)
- [x] Rascunho compartilhado e limpeza ao mudar de pergunta
- [x] Colapso de respostas longas no detalhe (e contexto do modal)
- [x] Ajuda in-app atualizada (`StackHelpModal`)

Detalhes operacionais e checklist QA: [ATENDE_STACK_OPERACAO.md § v2](./ATENDE_STACK_OPERACAO.md#atende-stack-v2-2026-09-28).

---

## 14. Referências no repositório

- Home e modais: `src/pages/Home.tsx`
- Atende Stack UI: `src/components/atende-stack/`, `src/services/atendeStackService.ts`
- Padrão fullscreen: `src/components/OutrosServicosModal.tsx`
- Rich text Scripts: `src/components/RichTextEditor.tsx`, `ScriptEditorFullscreen.tsx`
- Rich text Stack: `src/components/atende-stack/StackRichTextEditor.tsx` (`hideAssistant`)
- FTS Oráculo (referência SQL): `supabase/schema_dump.sql` — `oraculo_search_fts_highlighted`
- Notificações: `src/components/NotificationBadge.tsx`
- Roles: `src/contexts/AuthContext.tsx` (`user`, `supervisor`, `coordenador`, `admin`)
- Seeds / smoke: `docs/ATENDE_STACK_OPERACAO.md`, `scripts/atende-stack-seed-*.mjs`
- Migrations Stack: `supabase/migrations/2026092726*.sql`
