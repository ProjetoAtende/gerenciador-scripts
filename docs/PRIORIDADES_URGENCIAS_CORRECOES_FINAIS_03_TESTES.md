# Roteiro de testes — Correções Finais 03 (Prioridades e Urgências)

Documento para execução automatizada ou manual (Grokbot) após a entrega da rodada **Correções Finais 03** (out/2026).

## Reteste pós-hotfix (19/10/2026)

Correções após veredito **REPROVADO** (ReferenceError `ehGestor`):

| ID | O que validar |
|----|----------------|
| **H0** | Abrir Prioridades → app carrega (sem tela branca / console limpo) |
| **H1** | Gestor → **Log de acessos** visível; Coordenador/Analista **não** |
| **H2** | Gestor abre anotação **Devolvida** → consulta (não tela do Atendente) + aviso laranja de **correção automática** se engatilhada |
| **H3** | Atendente na devolução → **sem** aviso/selo de correção automática (A4) |
| **H4** | Botões: **Enviar Resposta** / **Reenviar como Nova** **antes** de **Aceitar** |
| **H5** | Diálogo aceite: só confirma com `ACEITO` **maiúsculo** (minúsculo não habilita) |
| **H6** | Coordenador (não admin) → Designações lista **somente analistas da própria UPJ** (U5) |

Demais casos da rodada anterior permanecem válidos (G1–G3, A1–A5, M2–M5, U1–U4, R1–R3, PC-03b).

### Resultado reteste (19/10/2026, DEV localhost:5174)

**Veredito: APROVADO COM RESSALVAS** — H0–H6, A1, M1 e U5 (gmira) OK.

| Ressalva | Tratamento |
|----------|------------|
| Card Prioridades ausente no grant “natural” de alguns usuários (ex. João Mendes) | Migration `20261019133000_prioridades_card_home_grant_usuario.sql` |
| Designação conferente recriada no harness | Dado de teste; sem alteração de produto |

## Pré-requisitos

- Migration aplicada: `20261019120000_prioridades_correcoes_finais_03.sql`
- Front-end desta versão (`gerenciador`, build ou `npm run dev`)
- Contas de teste: **Atendente A**, **Atendente B**, **Gestor**, **Conferente Designado**, **Coordenador UPJ**, **Analista Designado**
- Ao menos uma anotação **Devolvida** (Gestor) e uma **Retornada** (UPJ) em prazo aberto, para testes de aceite

**Abrir o app:** Home → card **Prioridades e Urgências**.

---

## Geral

### G1 — Link nas anotações prévias (120 dias)

| | |
|---|---|
| **Ator** | Atendente ou Gestor |
| **Passos** | Nova Anotação → processo com anotações nos últimos 120 dias → Verificar |
| **Esperado** | No aviso amarelo, cada linha tem **Ver anotação**; ao clicar abre **modal** com processo, status, descrição e trecho do histórico |

### G2 — Rótulo UPJ sem código FCC

| | |
|---|---|
| **Passos** | Gestor → Conferência de anotação → campo/select **UPJ de destino**; Gestor → **Designações** (coluna UPJ de analista) |
| **Esperado** | Exibe apenas o nome (ex.: `UPJ da 1ª a 5ª Varas Cíveis`), **sem** prefixo `FCC-XX-YY —` |

### G3 — Atualizar sem voltar ao dashboard

| | |
|---|---|
| **Passos** | Abrir Prioridades → navegar para uma lista ou detalhe → clicar **↻** no cabeçalho **ou** F5 no navegador |
| **Esperado** | Após recarregar, o modal **Prioridades** reabre na **mesma tela** (não fica só na Home). Fechar com **Fechar** limpa a sessão e F5 volta à Home normal |

---

## Módulo Atendentes

### A1 — Visibilidade só do criador

| | |
|---|---|
| **Pré** | Atendente A e B com anotações em Ag. Conferência / Aprovadas / Devolvidas |
| **Passos** | Login como **Atendente A** → percorrer Devolvidas, Ag. Conferência, Aprovadas, Reprovadas, Histórico Geral |
| **Esperado** | Só anotações cujo **criador** é A (contadores e listas). Anotações de B **não** aparecem |

### A2 — Designações ocultas

| | |
|---|---|
| **Ator** | Atendente |
| **Esperado** | Item **Designações** **ausente** no painel lateral |

### A3 — Aceitar Reprovação

| | |
|---|---|
| **Pré** | Anotação **Devolvida** (Gestor), prazo em curso |
| **Passos** | Abrir devolução → **Aceitar Reprovação** → ler texto → digitar `ACEITO` → confirmar |
| **Esperado** | Botão confirmar só habilita com `ACEITO`; status **Reprovada**; evento `aceite_reprovacao` no histórico |

### A4 — Ocultar correção automática (Atendente)

| | |
|---|---|
| **Pré** | Devolvida com `correcao_automatica` |
| **Esperado** | Na lista **Devolvidas** e na tela de resposta: **sem** selo/aviso “Correção automática engatilhada” |

### A5 — Timer hh:mm:ss e término do prazo

| | |
|---|---|
| **Passos** | Abrir anotação Devolvida |
| **Esperado** | Timer **hh:mm:ss** (segundos decrementando); abaixo, linha tipo **Segunda-feira, dia 19, 18:13** com data/hora fim do prazo |

---

## Módulo Gestores / Conferente Designado

### M1 — Designações só para Gestor (não Conferente)

| | |
|---|---|
| **Ator** | Conferente Designado |
| **Esperado** | **Designações** **ausente** no menu |

### M2 — Vinculação automática de Gestores

| | |
|---|---|
| **Ator** | Gestor |
| **Passos** | Designações → seção **Gestores** |
| **Esperado** | Lista de usuários perfil Gestor com checkbox **Vinculação automática** (alternar persiste após recarregar) |

### M3 — Realces vermelhos no menu (Gestor/Conferente)

| | |
|---|---|
| **Esperado** | Em vermelho: **Ag. Conferência** (bloco Atendentes) e **Retornadas** (bloco UPJs). Demais itens **sem** realce colorido (ex.: Devolvidas, Novas, Urgentíssimas) |

### M4 — Aceitar Rejeição (Retornada)

| | |
|---|---|
| **Pré** | Anotação **Retornada** pela UPJ |
| **Passos** | Corrigir anotação retornada → **Aceitar Rejeição** → `ACEITO` → confirmar |
| **Esperado** | Status **Rejeitada** (UPJ); histórico com `aceite_rejeicao_retorno` |

### M5 — Timer na correção de retornada

| | |
|---|---|
| **Esperado** | Prazo em **hh:mm:ss** + linha de término do prazo (como A5) |

---

## Módulo UPJ

### U1 — Retornadas no painel UPJ

| | |
|---|---|
| **Ator** | Coordenador ou Analista |
| **Esperado** | Em **Em Andamento**: **Novas**, **Em Análise**, **Retornadas** (Retornadas **sem** realce vermelho) |

### U2 — Designações só Coordenador

| | |
|---|---|
| **Atores** | Analista (sem menu) / Coordenador (com menu) |
| **Esperado** | Analista **não** vê Designações; Coordenador vê |

### U3 — Log de acessos oculto (UPJ)

| | |
|---|---|
| **Atores** | Coordenador, Analista |
| **Esperado** | **Log de acessos** **ausente**. Gestor **continua** vendo |

### U4 — Rejeição automática marcada por padrão

| | |
|---|---|
| **Passos** | UPJ → abrir análise → selecionar **Retornar** |
| **Esperado** | Checkbox **Rejeição automática** **marcada** ao abrir a tela |

### U5 — Designações restritas (Coordenador)

| | |
|---|---|
| **Ator** | Coordenador (não admin) |
| **Passos** | Designações |
| **Esperado** | Apenas tabela **Analistas Designados** (vinculação + Encerrar). **Sem** Incluir Designação, Conferentes, Gestores, Perfis base, designações encerradas |

---

## Regressão rápida

| ID | Verificação |
|----|-------------|
| R1 | Conferente ainda confere fila Ag. Conferência |
| R2 | Round-robin continua vinculando novas anotações |
| R3 | Responder devolução e Reenviar como Nova seguem funcionando |

---

## SQL / RPC (opcional)

```sql
-- Funções novas devem existir
SELECT proname FROM pg_proc
WHERE proname IN ('prioridades_aceitar_reprovacao', 'prioridades_aceitar_rejeicao_retorno');
```

---

## Evidências sugeridas (Grokbot)

- Captura de tela por caso **G3**, **A1**, **A3**, **M3**, **U1**, **U5**
- Export do histórico após aceites (**A3**, **M4**) mostrando eventos de aceite
