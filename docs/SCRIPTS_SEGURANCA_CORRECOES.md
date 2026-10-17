# Scripts — correções de segurança (out/2026)

Histórico das mudanças após testes Grok (baseline `reports/scripts-seguranca-2026-10-16/`, reteste `reports/scripts-seguranca-reteste-2026-10-16/`).

## Migrações

| Arquivo | Conteúdo |
|---------|----------|
| `20261016120000_scripts_seguranca_sc_c1_d2_f3.sql` | RLS `script_versoes` / `script_propostas_revisao`; RPCs `publicar_script_customizado`, `marcar_curadoria_script`, `notificar_script_participante`; revoke `criar_notificacao_script` para client; CHECK nome ≤ 200 |
| `20261017100000_scripts_seguranca_reteste_fixes.sql` | Trigger `trg_scripts_proteger_colunas_fluxo`; `REVOKE UPDATE` na tabela + `GRANT UPDATE` só colunas editáveis; hardening `notificar_script_participante` (sem NULL-trap, sem `metadata.curador_id`, valida UUID em `auth.users`); `REVOKE EXECUTE` das RPCs para `PUBLIC`/`anon`; purge de 2 notificações de incidente |

## Frontend

- Publicação / curadoria / notificações via RPCs (não PATCH direto em colunas de fluxo).
- Preview do editor: `sanitizeStackHtml` (DOMPurify).
- `renderHtmlReadonly` e `GeradorModal`: sanitização + bloqueio de `javascript:` em links.
- Meta CSP em `index.html` (efetivo após deploy GitHub Pages).
- Busca semântica por embedding **desativada** (sem OpenAI no projeto).
- Limite de 200 caracteres no título do script.

## Reteste — o que esta migration corrige

| Bug | Correção |
|-----|----------|
| SC-C1 | Trigger restaura colunas sensíveis + privilégio de UPDATE restrito por coluna |
| SC-F3-DEST | Destinatário validado com comparações explícitas e `COALESCE(v_dest_ok, false)` |
| SC-F3-META | Removido atalho `metadata.curador_id` |
| SC-RPC-GRANT / A3 | RPCs sem EXECUTE para `anon`/`PUBLIC` |
| SC-E1b | DOMPurify no readonly e Gerador |
| Incidente mgondim | DELETE das ids documentadas em `purge_teste.sql` (também na migration) |

## Deploy

1. `supabase db push` (migration remota).
2. Push `main` → GitHub Pages (CSP + UI).
