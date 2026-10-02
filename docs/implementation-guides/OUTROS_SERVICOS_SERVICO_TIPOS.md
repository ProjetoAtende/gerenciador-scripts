# Outros Serviços — Catálogo dinâmico (`servico_tipos`)

> **Data:** 02/10/2026  
> **Status:** Em produção (`rdkvvigjmowtvhxqlrnp`)  
> **Escopo:** Gerenciamento de tipos de serviço, integração com registros e Tarefas

---

## Visão geral

O módulo **Outros Serviços** (`OutrosServicosModal`) registra quantidades por tipo (`public.servicos.tipo`). Desde out/2026 os metadados do tipo (nome, unidade, ícone, dica) vivem em **`public.servico_tipos`**, referenciados por FK. Registros antigos guardam apenas o **slug** (`tipo`); label/ícone/unidade vêm do catálogo na exibição.

**Hub na Home:** card *Chamados & Outros Serviços* → subcard *Outros Serviços* (`PastelariaModal`).

---

## UI — abas do modal

| Aba | Componente / notas |
|-----|-------------------|
| Novo Serviço | Formulário; tipos do catálogo via `ServicoTiposContext` |
| Meus Serviços | Listagem pessoal |
| Serviços da Equipe | Listagem da equipe |
| Estatísticas | `ServicosEstatisticasTab` — [guia Estatísticas + Excel](./OUTROS_SERVICOS_ESTATISTICAS_EXCEL.md) |
| **Gerenciamento de Serviços** | `ServicosGerenciamentoTab` — visível para **todos** |

### Permissões na aba Gerenciamento

| Perfil (`users.role`) | Comportamento |
|----------------------|---------------|
| `user` | Somente leitura (lista + busca) |
| `supervisor`, `coordenador`, `admin` | Criar e editar tipos |

Frontend: `podeGerenciarTiposServico()` em `src/contexts/AuthContext.tsx`.  
Prop `somenteLeitura` em `ServicosGerenciamentoTab` (definida em `OutrosServicosModal`).

**Novo tipo:** slug gerado automaticamente a partir do **nome** (sem campo editável de código).

---

## Frontend — arquivos principais

| Arquivo | Papel |
|---------|--------|
| `src/contexts/ServicoTiposContext.tsx` | Provider; carrega RPC `listar_servico_tipos`; merge com `SERVICOS_CONFIG` se o banco falhar |
| `src/services/servicosService.ts` | `SERVICOS_CONFIG` (fallback), RPCs de catálogo, `TAREFA_SERVICO_EQUIVALENTE` |
| `src/components/ServicosGerenciamentoTab.tsx` | CRUD UI (gestores) |
| `src/components/OutrosServicosModal.tsx` | Abas e navegação |
| `src/main.tsx` | `ServicoTiposProvider` |

### Integração com Tarefas

Tarefas usam `TipoTarefa` em `src/types/Tarefa.ts`. Labels exibidos preferem o catálogo quando existe mapeamento em `TAREFA_SERVICO_EQUIVALENTE` (`resolveTipoTarefaLabel` / `useTipoTarefaLabel`).

- **Editar nome/ícone/unidade** de um tipo existente → reflete em Outros Serviços **e** nas labels de Tarefas ligadas ao mesmo slug.
- **Novo tipo** só em Outros Serviços → **não** aparece em Tarefas até existir `TipoTarefa` + entrada em `TAREFA_SERVICO_EQUIVALENTE` (se aplicável).

Conclusão de tarefa com serviço: `concluir_tarefa_com_servico` / `TarefaDetalheModal` usa `getConfig()` do contexto para unidade e label.

---

## Banco de dados

### Tabela `public.servico_tipos`

| Coluna | Descrição |
|--------|-----------|
| `codigo` | PK — slug (ex.: `homologacao`) |
| `label` | Nome exibido |
| `unidade` | `unidades` ou `horas` |
| `icone` | Emoji (texto) |
| `dica` | Texto de ajuda no formulário |
| `ativo` | Se false, oculto de novos registros |
| `eh_personalizado` | Tipos criados pela UI vs seed |

### `public.servicos`

- `tipo` → FK `servicos_tipo_fkey` → `servico_tipos(codigo)` (`ON UPDATE CASCADE`)
- Constraint legada `servicos_tipo_check` **removida** após catálogo (produção out/2026)

### Funções e RPCs

| Função | Uso |
|--------|-----|
| `servico_tipo_ativo(text)` | Valida tipo em `criar_servico` e troca de tipo em `atualizar_servico` |
| `servico_tipos_permitidos()` | Array de códigos ativos (derivado de `servico_tipos`; legado em outras RPCs) |
| `pode_gerenciar_servico_tipos(uuid)` | supervisor / coordenador / admin |
| `listar_servico_tipos(boolean)` | Leitura do catálogo (app) |
| `criar_servico_tipo(...)` | Insert (gestores) |
| `atualizar_servico_tipo(...)` | Update (gestores) |

RLS: SELECT para `authenticated`; INSERT/UPDATE/DELETE via policy `servico_tipos_gestores_write`.

---

## Migrations (produção)

Arquivos no repositório:

1. `supabase/migrations/20261002120000_servico_tipos_catalogo.sql` — tabela, seed, FK, RPCs base  
2. `supabase/migrations/20261002130000_servico_tipos_role_supervisor.sql` — permissões supervisor/coordenador  
3. `supabase/migrations/20261002140000_atualizar_servico_catalogo.sql` — `atualizar_servico` + `servico_tipos_permitidos` alinhados ao catálogo

> **Histórico remoto vs Git:** em produção, o deploy de out/2026 pode aparecer com timestamps diferentes (`20261002075408` … `20261002080137`) e nomes `20261002120000_servico_tipos_catalogo`, `…20001…`, `…20002…`, `…130000…`. O **conteúdo** equivale aos arquivos `20261002120000`, `20261002130000` e `20261002140000` do repositório; não é necessário renomear migrations locais se o SQL já foi aplicado no remoto.

**Reset local:** incluir `20261002120000`, `20261002130000` e `20261002140000` em `scripts/sb-reset.ps1` → `$PostResetMigrations` (passo 10e).

---

## Verificação pós-deploy (SQL)

```sql
SELECT count(*) FROM public.servico_tipos;
SELECT public.listar_servico_tipos(false);

SELECT conname FROM pg_constraint WHERE conname = 'servicos_tipo_fkey';

SELECT proname FROM pg_proc
WHERE proname IN (
  'listar_servico_tipos',
  'criar_servico_tipo',
  'atualizar_servico_tipo',
  'pode_gerenciar_servico_tipos'
);
```

Esperado: dezenas de linhas em `servico_tipos` (seed ~52), FK presente, RPCs existentes.

---

## Fallback offline

Se `listar_servico_tipos` falhar (migration não aplicada), o app usa `SERVICOS_CONFIG` estático em `servicosService.ts` e a aba Gerenciamento exibe aviso.

---

## Documentos relacionados

- [OUTROS_SERVICOS_ESTATISTICAS_EXCEL.md](./OUTROS_SERVICOS_ESTATISTICAS_EXCEL.md) — sub-abas Estatísticas, export Excel (html2canvas), changelog UI out/2026
- [SUPABASE_LOCAL_DOCKER_GUIA.md](../SUPABASE_LOCAL_DOCKER_GUIA.md) — §18.15 (seed `servicos`), §18.33 (catálogo)
- [SUPABASE_DEPLOY_PRODUCAO_GUIA.md](../SUPABASE_DEPLOY_PRODUCAO_GUIA.md) — §5 (verificação deploy)
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) — resumo para agentes

---

## Changelog consolidado (02/10/2026)

| Tema | Resumo |
|------|--------|
| **Catálogo** | Tabela `servico_tipos`, FK em `servicos`, RPCs, aba Gerenciamento (leitura todos / edição supervisor+) |
| **Slug** | Gerado só a partir do nome na UI |
| **Backend** | `criar_servico` / `atualizar_servico` validam via `servico_tipo_ativo`; migration `20261002140000` alinha `servico_tipos_permitidos()` |
| **Docs** | README, guias Docker/deploy/sincronização, copilot-instructions, este arquivo + Estatísticas/Excel |
| **Estatísticas** | Tabela Por Tipo simplificada; export Excel; período **Personalizado** (datas) — [guia Estatísticas](./OUTROS_SERVICOS_ESTATISTICAS_EXCEL.md) |
| **RPC estatísticas** | `20261002150000` + `20261002151000` (overload PostgREST) |
