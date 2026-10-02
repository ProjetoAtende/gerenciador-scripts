# Gerenciador Atende

Aplicação web para equipes de atendimento: **scripts operacionais**, **escala**, **links**, **registro de outros serviços** e **ferramentas de texto com IA**, com administração centralizada de setores, equipes e permissões.

Stack: **React 18 + TypeScript + Vite**, backend **Supabase** (Auth, Postgres, RLS, Edge Functions).

---

## O que a aplicação faz

Após login, o usuário escolhe a **equipe** e acessa uma **Home** com cabeçalho institucional TJSP (brasão, título, slogan, logos **eproc** e **TJSP Atende**) e cards controlados por permissão:

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

### Home — layout e flags de UI

Detalhes (header, eproc dark, assets): [`docs/HOME_UI_CHROME.md`](docs/HOME_UI_CHROME.md).

| Elemento | Arquivo / asset | Observação |
|----------|-----------------|------------|
| Cabeçalho institucional | `src/components/HomeInstitutionalHeader.tsx` | Layout NAPE; `public/tjsp-logotipo-oficial.png`, `public/eproc-logo.png`, `public/eproc-logo-dark.png` (dark), `public/tjsp-atende-logo.png` — `npm run logo:eproc` |
| Simulação “Visualização” (admin) | `src/components/HomeVisualizacaoSimulada.tsx` | **Desativada** — flag `HOME_VISUALIZACAO_SIMULACAO_ENABLED` em `SimulationContext.tsx` |
| Badge de versão / changelog | `src/components/VersionBadge.tsx` | **Oculto** — flag `VERSION_BADGE_ENABLED` |
| Rodapé | `src/components/FooterShadowFlow.tsx` | Apenas “ShadowFlow Technologies 2026”, altura mínima |

---

## Pré-requisitos

- Node.js 22+ (alinhado ao CI)
- Conta e projeto Supabase linkado
- Arquivo `.env` na raiz (não versionado), por exemplo:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

**Service role (scripts locais apenas):** use `SUPABASE_SERVICE_ROLE_KEY` no `.env` — **nunca** prefixo `VITE_` (o Vite embute `VITE_*` no bundle do browser). Modelo em `.env.example`. Operações admin no app usam a Edge Function `admin-users`.

Para **Pasquale**, a chave fica no Supabase Vault como `DEEPSEEK_API_KEY` (RPC `chamar_deepseek`; ver `supabase/migrations/20260927230000_chamar_deepseek_db6.sql`). Smoke opcional: `node scripts/migracao/run-mgmt-sql.mjs --file=scripts/migracao/smoke-deepseek.sql`.

---

## Comandos

```bash
npm install
npm run dev          # desenvolvimento local
npm run build        # tsc + vite + verificação anti service-role no bundle
npm run check:client-secrets   # só a checagem (após build ou em src/)
npm run test:run     # testes Vitest
npm run sb:push      # aplica migrations em supabase/migrations/ no projeto linkado
```

Deploy: push na branch `main` → GitHub Pages em **https://projetoatende.github.io/gerenciador-scripts/** (repositório [`ProjetoAtende/gerenciador-scripts`](https://github.com/ProjetoAtende/gerenciador-scripts), alinhado ao `base` em `vite.config.ts`).

Secrets de build no GitHub (Pages): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, chaves de IA com prefixo `VITE_` se usadas no client, e opcional `VITE_APP_PUBLIC_ORIGIN`. **Não** incluir service role no workflow de build — ver `scripts/check-client-bundle-secrets.mjs`.

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
