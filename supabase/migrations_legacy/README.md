# ⚠️ NÃO APLICAR — migrations legadas (referência)

Esta pasta contém o **histórico completo** do banco do antigo **Gerenciador de Chamados** (~289 arquivos). Ela existe apenas para consulta, diff e montagem manual de migrations — **não faz parte do fluxo do Gerenciador Atende**.

## O que usar no dia a day

| Ação | Pasta correta |
|------|----------------|
| `supabase db push` / deploy de schema Atende | [`../migrations/`](../migrations/) |
| Bootstrap de projeto novo Atende | Somente arquivos em `../migrations/` |
| Entender evolução antiga (Oráculo, Distribuidor, Radar…) | **Leitura** desta pasta |

## O que NÃO fazer

- **Não** mover arquivos daqui para `supabase/migrations/` e dar push no projeto remoto Atende.
- **Não** executar estes SQLs manualmente no SQL Editor do Supabase de produção “para sincronizar”.
- **Não** rodar `supabase db reset` esperando replay desta pasta (o CLI **não** aplica `migrations_legacy` automaticamente; o risco é alguém copiar/colar ou scriptar push em massa).

Aplicar o legado em um banco Atende já curado pode **recriar tabelas, políticas e funções** de módulos removidos do produto e corromper o recorte.

## Documentação

Ver [`../../docs/MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md`](../../docs/MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md) — seção **Artefatos legados — não executar**.
