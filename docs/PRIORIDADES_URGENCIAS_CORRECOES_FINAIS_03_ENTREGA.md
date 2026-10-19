# Prioridades e Urgências — Correções Finais 03 (entrega 19/10/2026)

Entrega alinhada ao documento **Prioridades e Urgências 03 — Correções Finais** e ao reteste Grokbot (veredito **APROVADO COM RESSALVAS** em DEV).

## Migrations (remoto)

| Arquivo | Conteúdo |
|---------|----------|
| `20261019120000_prioridades_correcoes_finais_03.sql` | `prioridades_pode_ver` (Atendente só criador); RPCs `prioridades_aceitar_reprovacao`, `prioridades_aceitar_rejeicao_retorno` |
| `20261019133000_prioridades_card_home_grant_usuario.sql` | Grant `home.card.prioridades_urgencias` por usuário ao designar/provisionar; backfill perfis/designações ativos |

Aplicar: `npm run sb:push` (projeto linkado).

## Front-end — resumo funcional

| Área | Entrega |
|------|---------|
| **Geral** | Modal consulta anotações 120 dias; rótulo UPJ sem `FCC-XX-YY`; botão ↻ + sessão (`prioridadesSessao.ts`) para F5 sem perder tela |
| **Atendente** | Só anotações próprias; sem Designações; Aceitar Reprovação; timer `hh:mm:ss` + término; ocultar correção automática |
| **Gestor / Conferente** | Realces menu; vinculação Gestores; Aceitar Rejeição; Designações só Gestor; devolvida abre consulta (não tela Atendente) |
| **UPJ** | Retornadas no menu; Designações Coordenador; log oculto UPJ; rejeição automática default; Designações restritas |

## Hotfix pós-reteste reprovado (mesmo dia)

- **`PrioridadesModal.tsx`:** restaurada `ehGestor` (`ReferenceError` → tela branca).
- **`PrioridadesContent`:** `gestor-devolvida` → modo `resposta` **apenas** para `perfilEfetivo === 'atendente'`.
- **`ConferenciaAnotacao`:** aviso laranja de correção automática na consulta (Gestor).
- **Botões:** Enviar/Reenviar antes de Aceitar; confirmação exige `ACEITO` maiúsculo.
- **`DesignacoesTela`:** Coordenador não-admin filtra analistas pela UPJ.

## Reteste Grok (19/10/2026)

- **H0–H6, A1, M1, U5 (gmira):** passaram.
- **Ressalvas:** card Home para alguns usuários sem grant por role → migration `113300`; designação de conferente recriada no harness (dado de teste).

## Testes

- Roteiro: [PRIORIDADES_URGENCIAS_CORRECOES_FINAIS_03_TESTES.md](PRIORIDADES_URGENCIAS_CORRECOES_FINAIS_03_TESTES.md)
- Unitários: `prioridadesListas.test.ts`, `cnjEPrazos.test.ts` (timer `hh:mm:ss`)

## Arquivos novos (componentes)

- `AceitarConfirmacaoDialog.tsx`, `AnotacaoConsultaModal.tsx`, `prioridadesSessao.ts`, `prioridadesUpjDisplay.ts`

## Referência cruzada

- Entrega anterior: [PRIORIDADES_URGENCIAS_ENTREGA_16-10-2026.md](PRIORIDADES_URGENCIAS_ENTREGA_16-10-2026.md)
- Uso operacional: [COMO_USAR_PRIORIDADES_URGENCIAS.md](COMO_USAR_PRIORIDADES_URGENCIAS.md)
