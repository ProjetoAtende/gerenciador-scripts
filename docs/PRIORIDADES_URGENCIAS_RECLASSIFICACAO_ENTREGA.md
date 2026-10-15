# Prioridades e Urgências — entrega da reclassificação (out/2026)

Registro do que foi implementado a partir de *Novas Especificações -
Prioridades e Urgências - TJSP Atende* e das respostas às pendências em
[PRIORIDADES_URGENCIAS_PENDENCIAS.md](PRIORIDADES_URGENCIAS_PENDENCIAS.md).

**Migrations:**

- `20261015112854_prioridades_reclassificacao.sql` — reclassificação principal
- `20261015121603_prioridades_fix_pr_g7_pr_h2.sql` — correções pós-teste (PR-G7, PR-H2)

**Status no banco remoto (projeto `lhofkimrmzyjazfpqesd`):** aplicadas via `supabase db push`.

Pontos **fora** desta entrega (decisão explícita): integração DataJud, melhoria
da pesquisa de processos/Vara, simplificação visual geral (item 3.2.3).

Dúvidas ainda abertas: [PRIORIDADES_URGENCIAS_DUVIDAS.md](PRIORIDADES_URGENCIAS_DUVIDAS.md).

---

## 1. Status e rótulos

| Antes (exemplos) | Agora (interface) | Observação |
|---|---|---|
| Pendente (UPJ) | **Nova** | Status operacional após aprovação |
| Analisada (UPJ) | **Em Análise** | Ao abrir a anotação Nova na UPJ |
| Devolvida (Gestor) | **Devolvida** | Atendente responde |
| Devolvida (UPJ) | **Retornada** | Gestor/Conferente corrige |
| Rejeitada (Gestor) | **Reprovada** | |
| Rejeitada (UPJ) | **Rejeitada** | |
| Reiterada (UPJ) como status | **Reiterada** (marca) | Cumulativa com Nova, Em Análise etc. |
| Urgentíssimo só manual | **Urgentíssimo** manual + **automático** (3+ em andamento) | Marcas cumulativas |

Aprovação pelo Gestor **não** deixa a anotação em `gestor-aprovada`: ela segue
direto para **Nova** na UPJ (PD-04, opção B). O evento de aprovação continua no
histórico.

---

## 2. Regras de negócio implementadas

### Reiterada (PD-02)

- Marca **todas** as anotações *em andamento* do mesmo processo quando há **2 ou
  mais** (Ag. Conferência, Devolvida, Retornada, Nova, Em Análise).
- Sai quando restam menos de duas em andamento (após Resolvida/Rejeitada/Reprovada
  etc.).
- Função: `prioridades_recalcular_especiais(processo)` — chamada nas transições
  relevantes.

### Urgentíssima automática (PD-05 + 2.2.2)

- Marca automática quando há **3 ou mais** anotações em andamento do mesmo
  processo (`urgentissimo_auto`).
- A marcação manual (`urgentissimo`) na conferência permanece independente.

### Em Análise (PD-03)

- Ao **abrir** uma anotação Nova (Coordenador/Analista), RPC
  `prioridades_marcar_em_analise` grava **Em Análise**.
- Resolver / Retornar / Rejeitar funcionam a partir de Nova **ou** Em Análise.

### Correções após devolução (Obs. 2 e 3)

- Atendente corrige **Devolvida** (Gestor) → volta **Ag. Conferência**.
- Gestor/Conferente corrige **Retornada** (UPJ) → reenvio como **Nova** (RPC
  `prioridades_corrigir_retornada`).

### Prazo de 24 h (PD-01 opção ideal + PD-14)

- Novas devoluções/retornos usam `prioridades_prazo_24h`: **24 h corridas** com
  pausa em sábado, domingo e dias em `prioridades_dias_sem_expediente`.
- Carga inicial dos dias copia feriado/emenda/recesso de
  `escala_agenda_institucional`, quando existir.
- Gestor mantém o calendário em **Configurações**.
- Prazos **já gravados** não são recalculados.

### Rejeição automática (PD-07)

- Na ação **Retornar**, checkbox **Rejeição automática** (`rejeicao_automatica`).
- Se marcada e o Gestor não corrigir no prazo, `prioridades_processar_prazos_vencidos`
  rejeita pela UPJ.
- Sem a marca, a Retornada permanece até correção manual.

### Outros itens fechados

- PD-06: observações internas do Atendente **opcionais** (já era; mantido).
- PD-08: campo **nome do solicitante** opcional (checkbox na Nova Anotação).
- PD-09: rótulo “Descrição do Tipo de Prioridade/Urgência (Outros)” mantido.
- PD-10: controle de vinculação automática mantido.
- PD-11: lista **Aprovadas** removida do painel UPJ; arquivo UPJ = Resolvidas +
  Rejeitadas.
- PD-12: catálogo já usa “Tramitação prioritária – PCD” (sem alteração de seed).
- PD-13: log de leitura do **admin** em `prioridades_log_acessos` (sem tela de
  consulta).

---

## 3. Interface

### Painel lateral (3.1.1.1)

- Sem alternância Atendente / Gestor / UPJ (admin global continua podendo operar
  conforme perfil base/designação).
- Layout por perfil: Atendente, Gestor/Conferente (seções Atendentes e UPJs),
  Coordenador/Analista.
- Realces de cor e contadores com selos 🔁 / ⚡ em Novas, Em Análise e Reiteradas.
- Painel **retrátil** (botão `<` / `>` na borda).
- Nome da **UPJ** no cabeçalho para Coordenador/Analista.
- **Configurações** (só Gestor de perfil base): calendário, regras especiais,
  preferência de fila.

### Nova Anotação (3.2.2, PD-08)

- Campos progressivos após consulta do processo.
- Modal de **regra especial** UPJ × tipo de prioridade (cadastro em
  Configurações).
- Lista UPJ exibe o **nome** da faixa de Varas (sem código `FCC-XX-YY` na UI).

### Vinculação (3.1.3.2)

- Rodízio (`prioridades_proximo_da_fila`) inclui **designações** ativas, não só
  perfil base.
- Conferente vê em Ag. Conferência / Retornadas só o vinculado a ele; Gestor
  pode restringir às próprias vinculações em Configurações.

### Visibilidade UPJ (3.1.4.1)

- Coordenador/Analista: RLS + `prioridades_pode_ver` limitam à **própria UPJ**.

---

## 4. Artefatos no repositório

| Área | Arquivos principais |
|---|---|
| Banco | `20261015112854_prioridades_reclassificacao.sql`, `20261015121603_prioridades_fix_pr_g7_pr_h2.sql` |
| Listas / contadores | `src/components/prioridades/prioridadesListas.ts` (+ testes Vitest) |
| UI | `PrioridadesSidebar.tsx`, `PrioridadesContent.tsx`, `NovaAnotacaoForm.tsx`, `AnaliseAnotacao.tsx`, `ConfiguracoesTela.tsx`, `CorrecaoRetornada.tsx` |
| Serviço | `prioridadesService.ts` (RPCs novas) |
| Tipos | `Prioridades.ts` |
| Pendências | `PRIORIDADES_URGENCIAS_DUVIDAS.md` |
| Testes manuais | [PRIORIDADES_URGENCIAS_RECLASSIFICACAO_TESTES.md](PRIORIDADES_URGENCIAS_RECLASSIFICACAO_TESTES.md) |

---

## 5. Deploy da aplicação

A migration já está no Supabase remoto. Para usar as telas novas:

1. Garantir build/deploy do front com este commit.
2. Executar o roteiro em
   [PRIORIDADES_URGENCIAS_RECLASSIFICACAO_TESTES.md](PRIORIDADES_URGENCIAS_RECLASSIFICACAO_TESTES.md).

Teste automatizado local (filtros de lista):

```bash
npx vitest run src/components/prioridades/prioridadesListas.test.ts
```

---

## 6. Correções pós-teste (15/10/2026)

Base: bateria Grok — veredito **APROVADO COM RESSALVAS** (31 passou, 1 parcial D3,
2 não testáveis G6/G7, J4 6/6). Relatório:
`reports/prioridades-reclassificacao-2026-10-15/RELATORIO_TESTE_RECLASSIFICACAO.md`.

| ID | Severidade | Correção (migration `20261015121603_…`) |
|---|---|---|
| **PR-G7** | média | `prioridades_processar_prazos_vencidos`: ao aplicar correção automática, o texto original da anotação passa a ser anexado em `observacao_adicional_gestor` (mesmo padrão de `conferir` / `corrigir_retornada`), mesmo quando já existia observação do Gestor. |
| **PR-H2** | baixa | `prioridades_regras_listar`: retorna vazio se o usuário **não** tiver perfil ativo em `prioridades_usuarios_perfil` (Atendente/Gestor/UPJ etc.). |

### Reteste dos bugs corrigidos

| Caso | Onde no roteiro | Esperado |
|---|---|---|
| **G7b** (PR-G7) | [TESTES § G7b](PRIORIDADES_URGENCIAS_RECLASSIFICACAO_TESTES.md) | Após `prioridades_processar_prazos_vencidos` (service_role/cron): correção automática aplicada **e** bloco “Texto original (correção automática por prazo…)” em `observacao_adicional_gestor`, sem perder observação prévia do Gestor. |
| **H2b** (PR-H2) | [TESTES § H2b](PRIORIDADES_URGENCIAS_RECLASSIFICACAO_TESTES.md) | RPC `prioridades_regras_listar` sem perfil Prioridades → 0 linhas; com perfil ativo → lista normal (Configurações / modal C3). |

Itens **não** corrigidos nesta rodada (registrados no relatório): **D3** parcial
(admin bypass em `prioridades_pode_ver`); **I1** log só via RPC na tela; **G6/G7**
fluxo completo depende de cron/service_role.

---

## 7. O que ainda depende da área

- Tabela **faixa de Varas → UPJ I–IX** para o rótulo romano (3.1.1.4).
- Esclarecimento dos itens 3.1.2.1 / 3.1.3.1 (campos por perfil).
- Política do **log de acesso** (quem consulta, retenção).
- DataJud / Vara correta — etapa futura.
