# Prioridades e Urgências — v2 (scripts de apoio)

Scripts usados no desenvolvimento da versão nova (`src/components/prioridades-v2`).
Nenhum deles roda no deploy.

## Dados de teste — `seed-testes.mjs` + `seed-testes.sql`

```bash
node scripts/prioridades-v2/seed-testes.mjs
```

- **Só roda no projeto Supabase de TESTES** (`utjkliwzwmifejqysmsy`): confere o `.env` e o
  projeto ligado (`supabase link`) e recusa qualquer outro, inclusive a produção.
- Cria 8 usuários fictícios (`*.teste@example.com`), um por perfil; as senhas geradas vão
  para `.env.usuarios-teste` (ignorado pelo Git).
- Provisiona perfis e designações e cria 15 anotações (série fictícia 99001xx/2026)
  passando pelas mesmas funções do app (`prioridades_designar`, `_criar_anotacao`,
  `_conferir`, `_analisar`...), "vestindo" cada usuário via `request.jwt.claims`.
- Libera o card da v2 aos usuários de teste.
- Pode ser rodado de novo: não duplica nada.

## Ícones — `icones-gerar.mjs` (e `icones-extrair-penpot.mjs`)

`src/components/prioridades-v2/icones.ts` é **gerado**: os ícones ficam embutidos no
código (nenhuma chamada externa, o que a política de segurança do site exige).

- A maioria vem dos conjuntos do Iconify indicados no guia de ícones das maquetes
  (pacotes `@iconify-json/<conjunto>`, instalados à parte, fora do projeto).
- Resolvidas, Rejeitadas e Reiteradas vêm dos desenhos do próprio arquivo do Penpot
  (`icones-extrair-penpot.mjs` lê o `.penpot`, que é um zip com um JSON por forma).
- Licenças de cada conjunto: `CREDITOS_ICONES` em `icones.ts` (para a tela Créditos).

Para trocar um ícone: ajuste o `MAPA` em `icones-gerar.mjs` e gere de novo:

```bash
node icones-gerar.mjs <pasta com node_modules/@iconify-json> <pasta dos SVGs do Penpot> src/components/prioridades-v2/icones.ts
```
