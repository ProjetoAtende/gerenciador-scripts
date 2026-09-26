# Gerenciador Atende

Aplicação web para equipes de atendimento: **scripts operacionais**, **escala**, **links**, **registro de outros serviços** e **ferramentas de texto com IA**, com administração centralizada de setores, equipes e permissões.

Stack: **React 18 + TypeScript + Vite**, backend **Supabase** (Auth, Postgres, RLS, Edge Functions).

---

## O que a aplicação faz

Após login, o usuário escolhe a **equipe** e acessa uma **Home** com cards controlados por permissão:

| Sistema | Descrição |
|---------|-----------|
| **Scripts** | Consulta, edição, versionamento, curadoria, cobertura e fluxo de exclusão com aprovação |
| **Scripts em Números** | Indicadores e gráficos sobre criação, revisão e propostas de scripts |
| **Escala** | Calendário da equipe (plantões, afastamentos, rotinas e agenda institucional) |
| **Pasquale** | Melhoria de redação via modelo DeepSeek (chamada server-side) |
| **Links Úteis** | Catálogo de links por equipe |
| **Outros Serviços** | Lançamento e acompanhamento de serviços operacionais |
| **Boss Only** | Gestão de setores, equipes, usuários e matriz de permissões (perfis supervisor/coordenador) |
| **Configurações** | Preferências pessoais (ex.: tema) |
| **Notificações** | Alertas de scripts e pedidos de exclusão pendentes |

Este repositório é um **recorte** do antigo Gerenciador de Chamados: não inclui Distribuidor, Oráculo, Radar SMAX, Tarefas, Pastelaria nem robôs de integração SMAX na interface principal.

---

## Estrutura do projeto

```
gerenciador/
├── src/                 # Frontend React (páginas, componentes, hooks, serviços)
├── supabase/
│   ├── migrations/      # Migrations ativas do Gerenciador Atende
│   ├── migrations_legacy/ # Histórico do monólito (referência)
│   └── functions/       # Edge Functions (ex.: admin-users)
├── scripts/migracao/    # Utilitários usados na montagem das migrations
├── docs/                # Memória de migração e documentação viva
├── archive/legacy/      # Docs, SQL e scripts do projeto Chamados (não usados no dia a dia)
└── .github/workflows/   # Deploy GitHub Pages
```

Detalhes da migração, cronologia de banco e decisões: [`docs/MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md`](docs/MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md).

---

## Pré-requisitos

- Node.js 22+ (alinhado ao CI)
- Conta e projeto Supabase linkado
- Arquivo `.env` na raiz (não versionado), por exemplo:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Para **Pasquale**, configure no Supabase Vault o secret `DEEPSEEK_API_KEY` (ver comentários em `supabase/migrations/20260927230000_chamar_deepseek_db6.sql`).

---

## Comandos

```bash
npm install
npm run dev          # desenvolvimento local
npm run build        # build de produção (tsc + vite)
npm run test:run     # testes Vitest
npm run sb:push      # aplica migrations em supabase/migrations/ no projeto linkado
```

Deploy: push na branch `main` → GitHub Pages em **https://projetoatende.github.io/gerenciador-scripts/** (repositório [`ProjetoAtende/gerenciador-scripts`](https://github.com/ProjetoAtende/gerenciador-scripts), alinhado ao `base` em `vite.config.ts`).

Variáveis de build no repositório: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc. Opcional: `VITE_APP_PUBLIC_ORIGIN` para sobrescrever a URL pública em e-mails.

---

## Banco de dados

- Schema evolutivo via **`supabase/migrations/`** (bootstrap, permissões, outros serviços, links, escala, scripts, DeepSeek).
- Permissões de cards da Home e scripts documentadas na migration `20260926500000_home_cards_gerenciador_atende.sql`.

### ⚠️ Legado — não executar

| Pasta | Uso |
|-------|-----|
| [`supabase/migrations/`](supabase/migrations/) | **Única** pasta para `npm run sb:push` |
| [`supabase/migrations_legacy/`](supabase/migrations_legacy/) | Referência histórica — **não** copiar para `migrations/` nem rodar em produção |
| [`archive/legacy/`](archive/legacy/) | Docs, SQL e scripts do Chamados — **não** executar no ambiente Atende |

Detalhes: [`docs/MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md`](docs/MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md) (seção 11).

---

## Licença e uso

Projeto interno TJSP. Não publicar credenciais, dumps completos ou chaves de API no repositório.
