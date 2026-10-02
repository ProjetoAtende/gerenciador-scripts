# Outros Serviços — Aba Estatísticas e exportação Excel

> **Data:** 02/10/2026  
> **Componente:** `src/components/ServicosEstatisticasTab.tsx`  
> **Relacionado:** [OUTROS_SERVICOS_SERVICO_TIPOS.md](./OUTROS_SERVICOS_SERVICO_TIPOS.md)

---

## Visão geral

A aba **Estatísticas** do modal Outros Serviços exibe um dashboard com quatro sub-abas:

| Sub-aba | Conteúdo resumido |
|---------|-------------------|
| **Visão Geral** | KPIs (registros, horas, unidades, tipo mais usado, membro mais ativo, média diária) + barra Horas vs Unidades |
| **Por Tipo** | Gráfico de barras (ranking) + tabela *Detalhamento por Tipo* |
| **Por Membro** | Gráfico de barras + cards por membro |
| **Linha do Tempo** | Volume por dia da semana, volume diário (área), heatmap dia × faixa horária |

Dados: RPC `obter_servicos_estatisticas_completas` via `obterEstatisticasCompletas()` em `servicosService.ts`. Seletor de equipe e período no topo da aba.

### Período

| Modo | UI | Backend |
|------|-----|---------|
| Presets | Pills 24h, 48h, 72h, 7 dias, 30 dias, Todo Período | `p_periodo`; `p_data_inicio` / `p_data_fim` omitidos (NULL) |
| **Personalizado** | Pill + dois `<input type="date">` + **Aplicar** | `p_periodo = 'custom'` + `p_data_inicio` + `p_data_fim` (date) |

**Regras de negócio**

- Filtro em `public.servicos.data_execucao` (não `criado_em`).
- Intervalo **inclusivo** por dia civil em **`America/Sao_Paulo`**: início = 00:00 do dia inicial; fim = até 23:59:59.999 do dia final (limite superior exclusivo no SQL: `(p_data_fim + 1)` à meia-noite SP).
- Personalizado: data final ≤ hoje; início ≤ fim; toast se o backend retornar erro (ex.: intervalo invertido).
- Ao escolher Personalizado, default **últimos 30 dias**; mudanças nas datas só disparam nova consulta após **Aplicar**.

**Frontend**

- `ServicosEstatisticasTab.tsx`: `periodo`, `customDraft`, `customAplicado`, `selecionarPeriodo`, `aplicarPeriodoCustom`.
- `servicosService.ts`: `PeriodoEstatisticasRequest` = preset (`PeriodoEstatistica`) ou `{ preset: 'custom', dataInicio, dataFim }` (strings `YYYY-MM-DD`).

**RPC (assinatura única — ver abaixo)**

```sql
obter_servicos_estatisticas_completas(
  p_equipe_id uuid,
  p_periodo text DEFAULT '30d',
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
```

Resposta JSON: campo `periodo` = preset (`30d`, `all`, …) ou `custom:YYYY-MM-DD:YYYY-MM-DD`.

**Migrations**

| Arquivo | Conteúdo |
|---------|----------|
| `20261002150000_servicos_estatisticas_periodo_custom.sql` | Nova assinatura com datas; `DROP` da função `(uuid, text)` **antes** do `CREATE` |
| `20261002151000_servicos_estatisticas_drop_overload.sql` | Correção em produção: remove overload `(uuid, text)` se ainda existir |

**PostgREST / overload (incidente out/2026)**

Se existirem **duas** funções `(uuid, text)` e `(uuid, text, date, date)`, chamadas só com `p_equipe_id` + `p_periodo` falham com:

`Could not choose the best candidate function between…`

**Causa:** `CREATE OR REPLACE` com parâmetros novos **cria** overload em PostgreSQL; não substitui a assinatura antiga.

**Correção:** manter **apenas** `(uuid, text, date, date)` com defaults nos dois últimos parâmetros.

Verificação:

```sql
SELECT p.oid::regprocedure AS signature
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'obter_servicos_estatisticas_completas'
  AND n.nspname = 'public';
-- Esperado: uma linha → obter_servicos_estatisticas_completas(uuid,text,date,date)
```

Smoke test personalizado (SQL Editor):

```sql
SELECT public.obter_servicos_estatisticas_completas(
  '<uuid-equipe>'::uuid,
  'custom',
  CURRENT_DATE - 7,
  CURRENT_DATE
);
```

**Reset local:** ambas migrations no passo 10e de `scripts/sb-reset.ps1`.

---

## Alterações de UI (02/10/2026)

### Sub-aba Por Tipo — tabela *Detalhamento por Tipo*

- Removida a coluna **Registros** (permanecem **Tipo**, **Quantidade**, **%**).
- Colunas **Quantidade** e **%** com alinhamento centralizado (cabeçalho e células).
- Removida a seção **Sem registros no período** (chips com tipos sem uso no intervalo).

### Comportamento inalterado na tela

- KPI **Total Registros** na Visão Geral e demais sub-abas seguem iguais.
- Cards em Por Membro na UI continuam com `truncate` no nome; só a **captura Excel** usa layout alternativo (ver abaixo).

---

## Exportação Excel

### Entrada na UI

- Botão **Excel** (ícone `FileSpreadsheet`, verde) à direita da navbar de sub-abas.
- Desabilitado enquanto carrega estatísticas ou não há `dados`.
- **Não** exporta cabeçalho “Estatísticas — Outros Serviços”, seletor de equipe/período nem a própria navbar.

### Estratégia principal: captura visual (html2canvas)

| Arquivo | Função |
|---------|--------|
| `src/utils/exportServicosEstatisticasExcelImages.ts` | Monta workbook **ExcelJS**, uma **imagem PNG** por aba |
| `ServicosEstatisticasTab.tsx` | Painéis off-screen, efeito de export, botão |

Fluxo:

1. `prepararCapturaExcel` monta quatro painéis invisíveis (`opacity: 0`, `top/left: 0`, `z-index: -1`, largura ~1080px).
2. Cada painel renderiza **somente** o conteúdo da sub-aba correspondente.
3. Aguarda ~1,1s (`aguardarRenderCaptura`) para Recharts estabilizar.
4. `html2canvas` em cada ref → imagem inserida na planilha homônima.

Abas do arquivo `.xlsx`:

- `Visão Geral`
- `Por Tipo`
- `Por Membro`
- `Linha do Tempo`

Nome do arquivo: `estatisticas_outros_servicos_{equipe}_{periodo}_{YYYY-MM-DD}.xlsx`.

### Fallback tabular (xlsx / SheetJS)

Se a captura falhar, o app chama `exportServicosEstatisticasExcel()` em `src/utils/exportServicosEstatisticasExcel.ts` (dados estruturados, sem gráficos) e exibe toast informando.

---

## Detalhes de implementação da captura

### Por Tipo (painel de export)

- `renderPorTipo(true)` omite o bloco **Evolução** (tipo selecionado interativamente) para o print não depender do estado da UI.

### Por Membro (painel de export)

- `renderPorMembro(true)`:
  - `items-start` nos cards (em vez de `items-center`).
  - Nome **sem** `truncate` → `break-words` + `leading-normal`.
  - Evita corte de descendentes no html2canvas.

### Medição de altura / corte inferior

Problema observado: **Visão Geral** saía com a parte inferior (Distribuição Horas vs Unidades) cortada.

Correções em `exportServicosEstatisticasExcelImages.ts`:

- Painéis **não** ficam mais em `left: -15000px` (layout incompleto off-screen).
- Altura de captura: `max(scrollHeight, offsetHeight, soma getBoundingClientRect dos filhos) + 48px`.
- Removidos `windowWidth` / `windowHeight` que limitavam o viewport do canvas.
- `onclone`: `overflow: visible` onde havia `hidden`; remove efeito de classe **`truncate`** no clone (quebra de linha + `line-height`).

### IDs SVG (Recharts)

- Gradientes com sufixos distintos na captura vs UI (`servicos-volume-diario-cap` / `-ui`, `servicos-evolucao-tipo-ui`) para evitar colisão quando painel oculto e aba visível coexistem durante o export.

---

## Manutenção

- Novo bloco visual numa sub-aba → incluir no render correspondente e, se só existir na UI interativa, considerar flag `forCapture` como em Por Tipo / Por Membro.
- Texto com `truncate` em área exportada → preferir variante `forCapture` ou tratar no `onclone`.
- Gráficos vazios na captura → aumentar `aguardarRenderCaptura` ou garantir largura fixa no pai do `ResponsiveContainer`.

---

## Registro de alterações (02/10/2026)

| Área | Mudança |
|------|---------|
| Catálogo `servico_tipos` | Gerenciamento, migrations, `atualizar_servico` — ver guia de tipos |
| Docs / README | Guias Supabase, copilot-instructions, README do projeto |
| Estatísticas — tabela Por Tipo | Sem coluna Registros; sem “Sem registros no período”; % e Quantidade centralizados |
| Estatísticas — Excel | Botão navbar; export imagem por sub-aba; fallback tabular |
| Excel — captura | Posicionamento in-viewport; medida de altura; onclone truncate/overflow |
| Excel — Por Membro | Layout `forCapture` para nomes completos na imagem |
| Estatísticas — período | Pill Personalizado + datas; RPC com `p_data_inicio` / `p_data_fim` |
| RPC — overload | `20261002151000` remove `(uuid,text)` duplicada; doc PostgREST acima |
