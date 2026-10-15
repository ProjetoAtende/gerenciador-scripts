# Roteiro de testes — reclassificação Prioridades e Urgências

Casos focados **somente** no que mudou na entrega de out/2026. Para o fluxo
completo do app, use também
[COMO_USAR_PRIORIDADES_URGENCIAS.md](COMO_USAR_PRIORIDADES_URGENCIAS.md).

**Pré-requisitos**

- Migrations `20261015112854_prioridades_reclassificacao` e
  `20261015121603_prioridades_fix_pr_g7_pr_h2` aplicadas no banco (remoto: 15/10/2026).
- Front-end desta versão (build local: `npm run dev` ou deploy publicado).
- Pelo menos: 1 Atendente, 1 Gestor, 1 Conferente designado, 1 Coordenador e 1
  Analista, cada um com UPJ correta onde couber.
- Dois processos CNJ válidos para teste (use números de homologação conhecidos
  no DJEN, se possível).

**Como abrir:** Home → card **Prioridades e Urgências**.

---

## A. Painel e navegação

### A1 — Perfil fixo (sem abas de módulo)

| | |
|---|---|
| **Atores** | Atendente, Gestor, Coordenador (contas distintas) |
| **Passos** | Entrar com cada usuário e observar o painel lateral. |
| **Esperado** | Não há abas “Atendentes / Gestores / UPJs”. Cada perfil vê **apenas** o menu da sua função (listas da especificação 3.1.1.1). |

### A2 — Painel retrátil

| | |
|---|---|
| **Passos** | Clicar no botão `<` / `>` na borda do painel. |
| **Esperado** | Painel recolhe/expande; área principal ganha largura (útil em celular). |

### A3 — UPJ no cabeçalho (Coordenador/Analista)

| | |
|---|---|
| **Passos** | Login como Coordenador ou Analista com `upj_id` definida. |
| **Esperado** | Nome da UPJ aparece abaixo do perfil no painel. |

### A4 — Contadores e selos

| | |
|---|---|
| **Pré** | Ter anotações Nova e Em Análise; ao menos uma Reiterada e uma Urgentíssima. |
| **Passos** | Conferir listas **Novas**, **Em Análise**, **Reiteradas** no painel UPJ/Gestor. |
| **Esperado** | Contador principal + selos 🔁 (reiteradas na lista) e ⚡ (urgentíssimas na lista), conforme 3.1.4.4. |

---

## B. Rótulos de status

### B1 — Badges na lista e no detalhe

| | |
|---|---|
| **Passos** | Abrir anotações em Nova, Em Análise, Devolvida, Retornada, Reprovada, Resolvida, Rejeitada. |
| **Esperado** | Textos: **Nova**, **Em Análise**, **Devolvida**, **Retornada**, **Reprovada**, **Resolvida**, **Rejeitada** (não “Pendente (UPJ)” nem “Analisada (UPJ)”). |

### B2 — Marcas Reiterada / Urgentíssima

| | |
|---|---|
| **Passos** | Anotação que esteja Reiterada e/ou Urgentíssima. |
| **Esperado** | Selos **Reiterada** e **Urgentíssimo** no card, **além** do badge de status (Nova, Em Análise, etc.). |

---

## C. Nova Anotação (Atendente)

### C1 — Preenchimento progressivo

| | |
|---|---|
| **Passos** | Nova Anotação → informar processo → Verificar (DJEN). |
| **Esperado** | Antes da consulta: só processo. Depois: Solicitante; depois Tipo; depois demais campos. |

### C2 — Nome do solicitante (PD-08)

| | |
|---|---|
| **Passos** | Marcar “Incluir o nome do(a) Solicitante”, preencher nome, enviar. |
| **Esperado** | Campo só aparece com checkbox marcado. UPJ/Gestor veem o nome na análise/conferência. |

### C3 — Regra especial UPJ

| | |
|---|---|
| **Pré** | Gestor cadastrou regra em **Configurações** para UPJ X + tipo Y. |
| **Passos** | Atendente: processo mapeado para UPJ X → escolher tipo Y. |
| **Esperado** | Modal com texto da regra; botão “Entendi” fecha e permite seguir. |

### C4 — Lista UPJ sem código FCC

| | |
|---|---|
| **Passos** | Abrir select “UPJ de destino”. |
| **Esperado** | Opções no formato “UPJ da Xª a Yª Varas Cíveis” (sem prefixo `FCC-01-05`). |

---

## D. Conferência (Gestor / Conferente)

### D1 — Aprovação → Nova na UPJ

| | |
|---|---|
| **Passos** | Conferir e **Aprovar** anotação em Ag. Conferência. |
| **Esperado** | Status na UPJ: **Nova** (não “Aprovada” parada). Histórico registra aprovação + remessa. Lista **Aprovadas** do Atendente/Gestor inclui a anotação. |

### D2 — Urgentíssimo manual

| | |
|---|---|
| **Passos** | Aprovar marcando Urgentíssimo. |
| **Esperado** | Aparece em **Urgentíssimas** e mantém selo ⚡ mesmo em Nova/Em Análise. |

### D3 — Conferente só vê vinculadas

| | |
|---|---|
| **Pré** | Duas anotações Ag. Conferência vinculadas a conferentes diferentes. |
| **Passos** | Login como Conferente A. |
| **Esperado** | Ag. Conferência lista **somente** anotações vinculadas a A (ou criadas por A). |

### D4 — Gestor: fila ampla vs. só vinculadas

| | |
|---|---|
| **Passos** | Configurações → marcar “só anotações vinculadas a mim” → conferir Ag. Conferência e Retornadas. Desmarcar e repetir. |
| **Esperado** | Com marca: só vinculadas ao Gestor. Sem marca: inclui fila dos Conferentes. Outras listas UPJ (Novas, Resolvidas…) **não** mudam com essa opção. |

---

## E. Reiterada e Urgentíssima automática

### E1 — Duas anotações em andamento

| | |
|---|---|
| **Passos** | Mesmo processo: registrar **duas** anotações que cheguem à UPJ (Novas) sem resolver. |
| **Esperado** | Ambas com marca **Reiterada**; aparecem em **Reiteradas** e ainda em **Novas**. |

### E2 — Terceira anotação → Urgentíssima automática

| | |
|---|---|
| **Passos** | Registrar **terceira** anotação em andamento no mesmo processo. |
| **Esperado** | **Todas** as em andamento ganham Urgentíssimo (automático); listas **Urgentíssimas** e selo ⚡. |

### E3 — Saída da marca ao resolver

| | |
|---|---|
| **Passos** | UPJ **Resolve** uma das três. |
| **Esperado** | `prioridades_recalcular_especiais` reduz contagem; se ficar &lt; 2, Reiterada some; se &lt; 3, Urgentíssima automática some (manual do Gestor permanece se existir). |

---

## F. UPJ — Em Análise e decisões

### F1 — Abrir Nova → Em Análise

| | |
|---|---|
| **Passos** | Coordenador abre anotação **Nova** (clique para analisar). |
| **Esperado** | Status passa a **Em Análise**; permanece editável para Resolver/Retornar/Rejeitar. |

### F2 — Resolver a partir de Em Análise

| | |
|---|---|
| **Passos** | Em Análise → **Resolver**. |
| **Esperado** | **Resolvida**; some de Novas/Em Análise; entra em Resolvidas. |

### F3 — Retornar com rejeição automática

| | |
|---|---|
| **Passos** | Retornar com justificativa + marcar **Rejeição automática**. |
| **Esperado** | Status **Retornada**; prazo visível; flag gravada. |

### F4 — Isolamento por UPJ

| | |
|---|---|
| **Passos** | Coordenador UPJ A tenta abrir anotação destinada à UPJ B (URL/id se souber). |
| **Esperado** | Não listada no painel; detalhe inacessível ou “sem permissão”. |

---

## G. Devoluções, retornos e prazos

### G1 — Devolvida (Gestor) → Atendente

| | |
|---|---|
| **Passos** | Gestor **Devolve** na conferência. Atendente responde. |
| **Esperado** | Volta **Ag. Conferência**; prazo para Atendente; **não** aparece como Retornada. |

### G2 — Retornada → Gestor corrige

| | |
|---|---|
| **Passos** | UPJ Retorna → Gestor abre **Corrigir anotação retornada** → Reenviar como Nova. |
| **Esperado** | Status **Nova** na UPJ; histórico preservado; `rejeicao_automatica` desligada após correção. |

### G3 — Prazo pausa fim de semana (amostral)

| | |
|---|---|
| **Passos** | Devolver na **sexta** tarde; anotar `prazo_resposta_em` exibido. |
| **Esperado** | Vencimento cai em **segunda** no mesmo horário (aprox.), não no sábado. |

### G4 — Dia sem expediente (Configurações)

| | |
|---|---|
| **Passos** | Gestor inclui **amanhã** como dia sem expediente. Devolver anotação **hoje**. |
| **Esperado** | Contagem de 24 h **pula** o dia cadastrado (além de sáb/dom). |

### G5 — Prazo antigo não muda

| | |
|---|---|
| **Pré** | Anotação já devolvida **antes** da migration, com prazo gravado. |
| **Passos** | Comparar `prazo_resposta_em` antes/depois da migration. |
| **Esperado** | **Igual** (PD-14). |

### G6 — Rejeição automática por prazo

| | |
|---|---|
| **Pré** | Retornada com rejeição automática; **não** corrigir. |
| **Passos** | Aguardar vencimento ou disparar manualmente (se houver botão/admin) `prioridades_processar_prazos_vencidos`. |
| **Esperado** | Status **Rejeitada** (UPJ); evento no histórico. |

### G7 — Correção automática (Gestor → Atendente)

| | |
|---|---|
| **Passos** | Devolver com **correção automática** engatilhada; Atendente **não** responde até vencer. |
| **Esperado** | Sistema envia texto de correção e anotação vira **Nova** na UPJ (comportamento anterior mantido). |

### G7b — Texto original preservado (PR-G7, pós-correção)

| | |
|---|---|
| **Pré** | Devolução com correção automática **e** observação do Gestor preenchida na conferência. |
| **Passos** | Disparar `prioridades_processar_prazos_vencidos` (service_role/cron). |
| **Esperado** | `descricao_prioridade` = texto da correção automática; em `observacao_adicional_gestor` permanecem a observação do Gestor **e** bloco “Texto original (correção automática por prazo…)”. |

---

## H. Configurações (Gestor)

### H1 — Calendário

| | |
|---|---|
| **Passos** | Incluir e remover um dia de teste. |
| **Esperado** | Lista atualiza; apenas Gestor de perfil base altera (Conferente não vê ou não grava). |

### H2 — Regras especiais

| | |
|---|---|
| **Passos** | Salvar texto; repetir C3. Limpar texto e salvar. |
| **Esperado** | Modal deixa de aparecer após remoção da regra. |

### H2b — Listagem restrita (PR-H2, pós-correção)

| | |
|---|---|
| **Passos** | Com usuário **sem** perfil em Prioridades, chamar RPC `prioridades_regras_listar`. Repetir com Atendente/Gestor. |
| **Esperado** | Sem perfil: **0 linhas**. Com perfil ativo: lista normal (Configurações / modal C3). |

---

## I. Admin e auditoria

### I1 — Log de acesso privilegiado

| | |
|---|---|
| **Passos** | Admin abre anotação **de outro** usuário. |
| **Esperado** | Linha em `prioridades_log_acessos` (consulta SQL ou Supabase Table Editor). Admin abrindo **própria** anotação: sem registro. |

---

## J. Regressão rápida

| # | Verificação |
|---|---|
| J1 | DJEN / Nova Anotação ainda valida CNJ e envia para Ag. Conferência. |
| J2 | Designações e perfil base continuam funcionando. |
| J3 | Histórico Geral lista transições com status novos legíveis. |
| J4 | `npx vitest run src/components/prioridades/prioridadesListas.test.ts` — 6 testes OK. |

---

## Registro de execução (preencher no teste)

| Caso | Data | Executor | OK / Falha | Observação |
|---|---|---|---|---|
| A1 | | | | |
| … | | | | |

**Referência técnica:** [PRIORIDADES_URGENCIAS_RECLASSIFICACAO_ENTREGA.md](PRIORIDADES_URGENCIAS_RECLASSIFICACAO_ENTREGA.md)
