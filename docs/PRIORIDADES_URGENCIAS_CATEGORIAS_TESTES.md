# Roteiro de testes — Categoria da Anotação (Prioridades e Urgências)

Documento para execução automatizada ou manual (**Grokbot**) após a entrega da funcionalidade **Categoria da Anotação** (out/2026), conforme solicitação em *Categorias.md*.

## Pré-requisitos

- Migration aplicada: `20261019140000_prioridades_categoria_anotacao.sql`
- Front-end desta versão (`gerenciador`, build ou `npm run dev`)
- Contas de teste: **Atendente**, **Gestor**, **Conferente Designado**, **Coordenador UPJ**, **Analista Designado A**, **Analista Designado B** (mesma UPJ, categorias distintas)
- Processo válido na competência TJSP Atende (CNJ 20 dígitos, DJEN ou manual)

**Abrir o app:** Home → card **Prioridades e Urgências**.

---

## C1 — Nova Anotação: área Categoria da Anotação

| | |
|---|---|
| **Ator** | Atendente |
| **Passos** | Nova Anotação → Verificar processo competente → preencher Solicitante (e nome opcional) |
| **Esperado** | Aparece **Categoria da Anotação** (8 rádios, 2×4) **antes** de **Tipo de Prioridade/Urgência**; cada rótulo tem ℹ️ com tooltip ao passar o mouse |
| **Passos** | Tentar enviar sem categoria |
| **Esperado** | Bloqueio com mensagem / campo pendente **Categoria da Anotação** |
| **Passos** | Selecionar **Sisbajud** → completar formulário → enviar |
| **Esperado** | Anotação criada; nas listas, badge **Sisbajud** ao lado do status |

---

## C2 — Rótulo de categoria nas listas

| | |
|---|---|
| **Ator** | Gestor ou Coordenador |
| **Passos** | Abrir painel inicial ou lista **Novas** / **Ag. Conferência** |
| **Esperado** | Cards exibem badge da categoria (ex.: **MLE**, **Expedição**) além dos selos já existentes (Nova, Reiterada, Urgentíssima etc.) |

---

## C3 — Filtro por categoria (Coordenador / Analista)

| | |
|---|---|
| **Ator** | Coordenador ou Analista |
| **Pré** | UPJ com anotações em categorias diferentes (ex.: MLE e Sisbajud) |
| **Passos** | No painel UPJ, usar **Filtrar categoria** → **Sisbajud** |
| **Esperado** | Contadores e listas mostram **somente** anotações Sisbajud; **Todas** restaura a visão completa (respeitando regras de perfil) |
| **Ator** | Atendente ou Gestor |
| **Esperado** | Seletor **Filtrar categoria** **ausente** |

---

## C4 — Designações: Categorias habilitadas (Analistas)

| | |
|---|---|
| **Ator** | Gestor (ou Coordenador da UPJ) |
| **Passos** | Designações → tabela **Analistas Designados** |
| **Esperado** | Coluna **Categorias habilitadas** com 8 checkboxes; coluna **Vinculação automática** **ausente** para analistas |
| **Passos** | Analista A: marcar só **MLE** e **Sisbajud**; Analista B: marcar só **Cadastro** |
| **Esperado** | Persistência após recarregar a tela |

---

## C5 — Vinculação automática omitida para UPJ

| | |
|---|---|
| **Passos** | Designações → **Conferentes Designados** |
| **Esperado** | Coluna **Vinculação automática** **presente** (funcionalidade mantida no backend, só oculta para analistas/coordenador na UI de analistas) |
| **Passos** | Tabela **Analistas Designados** |
| **Esperado** | **Sem** coluna Vinculação automática |

---

## C6 — Visibilidade do Analista por categoria

| | |
|---|---|
| **Pré** | Anotacao **Cadastro** na UPJ; Analista A habilitado só MLE/Sisbajud |
| **Passos** | Login **Analista A** → painel UPJ |
| **Esperado** | Anotação **Cadastro** **não** aparece (lista vazia ou contagem menor) |
| **Passos** | Login **Analista B** (só Cadastro) |
| **Esperado** | Anotação **Cadastro** **visível** e abrível |
| **Passos** | Login **Coordenador** (mesma UPJ) |
| **Esperado** | Vê **todas** as categorias; pode restringir com filtro C3 |

---

## C7 — Conferência: alterar categoria

| | |
|---|---|
| **Ator** | Gestor ou Conferente |
| **Pré** | Anotação em **Ag. Conferência** com categoria **MLE** |
| **Passos** | Conferência → alterar categoria para **Expedição** → aprovar com UPJ válida |
| **Esperado** | Remessa OK; na UPJ badge **Expedição**; histórico registra alteração quando aplicável |

---

## C8 — Dados legados (migration)

| | |
|---|---|
| **Passos** | (SQL ou inspeção admin) `SELECT categoria, descricao_prioridade FROM prioridades_anotacoes WHERE id = <anotação_antiga>` |
| **Esperado** | `categoria = 'mle'`; descrição contém trecho sobre categoria incluída por padrão (pré-implantação) |

---

## C9 — Regressão rápida

| ID | O que validar |
|----|----------------|
| **R1** | Nova Anotação ainda exige processo, solicitante, tipo prioridade, evento, descrição |
| **R2** | F5 / ↻ mantém sessão do modal Prioridades (correções finais 03) |
| **R3** | Atendente continua vendo só anotações próprias |

---

## Veredito sugerido

- **APROVADO** — C1–C9 OK  
- **APROVADO COM RESSALVAS** — falha pontual documentada  
- **REPROVADO** — bloqueio em C1, C4 ou C6

---

## Resultado Grokbot (19/10/2026, DEV localhost:5174)

**Veredito: APROVADO**

| Casos | Resultado |
|-------|-----------|
| C1–C9 | Passou |
| R1–R3 | Passou |

**Destaques:** C4/C6 com Analista A (MLE + Sisbajud) e B (só Cadastro) na mesma UPJ — A não vê Cadastro, B vê; Coordenador vê tudo. Filtro de categoria só no perfil UPJ. Vinculação automática oculta para analistas e mantida para conferentes. Conferência altera categoria. Legado backfill MLE OK.

**Nota de teste:** na 1ª tentativa do C6, usuário **admin** enxergava todas as anotações (comportamento esperado de auditoria em `prioridades_pode_ver`); reteste com usuário **não admin** (ex.: gmira) passou.

**Dados:** anotações `[TESTE] CAT*` 116–121 em `upj-rejeitada` (nenhuma aberta). Sem bugs de produto. Relatório e capturas mantidos pelo executor do teste.
