# Copilot Instructions - Gerenciador de Chamados

## Visão Geral da Arquitetura

Sistema de gerenciamento de chamados com interface web React + Vite e aplicativo mobile via Capacitor. Backend totalmente em Supabase (PostgreSQL, Auth, Edge Functions).

### Stack Principal
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Mobile**: Capacitor (Android)
- **Backend**: Supabase (PostgreSQL + RLS + Edge Functions)
- **IA**: DeepSeek (via RPC Supabase), OpenAI (embeddings), Whisper (transcrição)
- **Deploy**: GitHub Pages (web), Android Studio (mobile)

### Estrutura de Pastas Chave

```
src/
├── components/          # Componentes UI (modais, cards, tabelas)
├── contexts/            # AuthContext é o principal (autenticação + equipeId)
├── features/            # Features isoladas (ConsultaDrawer, etc)
├── hooks/               # Custom hooks
├── pages/               # Home.tsx, LoginPage.tsx, EquipeSelectorPage.tsx
├── services/            # Todas as integrações (Supabase, OpenAI, DeepSeek)
│   └── oracle/          # ⭐ Sistema Oráculo modular refatorado
└── types/               # Tipos TypeScript
```

## Padrões de Código Importantes

### Supabase Client
- Use `supabaseClient.ts` para operações com RLS (usuário autenticado)
- **Nunca** use service role no browser (`src/`). Admin via Edge Function `admin-users`
- Scripts Node usam `SUPABASE_SERVICE_ROLE_KEY` (sem prefixo `VITE_`) — ver `scripts/lib/serviceRoleEnv.mjs`
- Scripts leem `.env` manualmente com `loadEnv()` pattern

### Sistema Oráculo (Busca Inteligente)
O módulo `src/services/oracle/` é a arquitetura moderna. **Não use `oracleService.ts`** (deprecated).

```typescript
// ✅ Correto
import { searchChamados, uploadExcelFile } from '../services/oracle';

// ❌ Evitar (deprecated)
import { searchChamados } from '../services/oracleService';
```

### Chamadas de IA via RPC
DeepSeek é chamado via RPC do Supabase para evitar CORS:

```typescript
const { data } = await supabase.rpc('chamar_deepseek', {
  p_messages: messages,
  p_model: 'deepseek-chat',
  p_temperature: 0.3
});
```

### Variáveis de Ambiente
Prefixo `VITE_` **somente** para variáveis intencionalmente expostas no bundle:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_DEEPSEEK_API_KEY`

Secrets de servidor / scripts locais (**sem** `VITE_`):
- `SUPABASE_SERVICE_ROLE_KEY` — scripts em `scripts/` e Edge Functions; nunca referenciar em `src/`

## Comandos de Desenvolvimento

```bash
# Desenvolvimento local
npm run dev

# Build produção (GitHub Pages)
npm run build

# Build Android (Capacitor)
npm run android  # Build completo + sync + abre Android Studio

# Executar scripts TypeScript
npx tsx scripts/nome-do-script.ts
```

## Convenções de Nomenclatura

### Componentes React
- Modais: `*Modal.tsx` (ex: `EstatisticasModal.tsx`)
- Cards: `*Card.tsx` (ex: `ChamadoCard.tsx`)
- Contextos: `*Context.tsx`

### Serviços
- `*Service.ts` para integrações externas
- Funções assíncronas retornam `Promise<T>` tipado

### Banco de Dados (Supabase)
- Schemas SQL em `sql/database-schemas/`
- Migrações em `sql/migrations/` com prefixo de ação (`add_`, `fix_`, `sync_`)
- Funções PostgreSQL seguem padrão `nome_acao` (snake_case)

## Sistemas Principais

### 1. Chamados
- Tabela `chamados` com RLS por `equipe_id`
- Status: pendente, em andamento, concluído, suspenso
- Realtime habilitado para atualizações

### 2. Oráculo
- Tabelas em `public`: `oraculo_chamados`, `oraculo_configuracao`, `oraculo_mv_stats_diario` (migradas do antigo schema `oraculo`)
- Busca híbrida: Full-Text Search + Embeddings OpenAI
- Fallback automático para estratégias de busca
- Analytics em `oraculo_search_analytics`
- **NÃO usar** `.schema('oraculo')` — tabelas estão em `public` com prefixo `oraculo_`

### 3. Agente Smith (Knowledge Processor)
- Sistema Python em `smith-knowledge-processor/`
- Processa PDFs/DOCX/TXT para base de conhecimento
- FTS PostgreSQL sem embeddings (mais rápido/barato)
- Tabelas em `public`: `kb_documentos`, `kb_segmentos`, `kb_qa_pairs` (migradas do antigo schema `knowledge_base`)
- Funções: `kb_buscar_conhecimento`, `kb_obter_estatisticas`, `kb_listar_documentos`, etc.
- **NÃO usar** `.schema('knowledge_base')` — tabelas estão em `public` com prefixo `kb_`

### 4. Lambda AWS
- `lambda/processar-email-chamados/` - Processa emails do SES
- Deploy manual via ZIP ou AWS CLI

## Notas de Integração

### AuthContext
Sempre use o hook `useAuth()` para acessar usuário e equipe:

```typescript
const { user, equipeId, logout } = useAuth();
```

### Realtime Supabase
Componente `PresenceManager` gerencia presença de usuários online.

### Mobile (Capacitor)
- Configs em `capacitor.config.ts`
- Build Android: `npm run cap:build`
- Abre Android Studio: `npm run cap:open`

## Anti-Padrões a Evitar

- ❌ Chamar APIs externas diretamente do frontend (use RPC Supabase)
- ❌ Hardcoded `equipe_id` - sempre via `useAuth().equipeId`
- ❌ Usar `oracleService.ts` diretamente - módulo deprecated
- ❌ Queries sem paginação em tabelas grandes (use `ITENS_POR_PAGINA_SERVER`)

---

## Ambiente Padrão — Supabase Produção

### Configuração de ambiente

- **Padrão:** `.env` aponta para **produção** (`rdkvvigjmowtvhxqlrnp.supabase.co`)
- **Local (Docker):** Disponível via `.env.local.docker` — usar apenas quando solicitado explicitamente
- **Projeto linkado:** `rdkvvigjmowtvhxqlrnp.supabase.co`
- **Supabase CLI:** instalado via `npm install -g supabase`

### Variáveis de ambiente para scripts

Scripts usam o helper `loadLocalEnv()` que por padrão carrega `.env` (produção):

```typescript
import { loadLocalEnv } from '../loadLocalEnv';
loadLocalEnv(); // Carrega .env (produção) por padrão
```

Para forçar banco local (Docker): `USE_LOCAL=true npx tsx scripts/meu-script.ts`

### Ambiente Local (Docker) — Homologação

Quando trabalhando em mudanças de banco de dados que precisam de teste local:

**Credenciais locais (apenas localhost, sem risco):**
```
URL:              http://127.0.0.1:54321
Anon Key:         eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
Service Role:     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
DB URL:           postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio:           http://127.0.0.1:54323
```

### Controle do ambiente local

```powershell
supabase start          # Iniciar (requer Docker rodando)
supabase stop           # Parar
supabase status         # Ver URLs
supabase db reset       # Resetar banco e aplicar migrations
supabase db diff --linked -f nome   # Gerar migration do diff
supabase db push        # Aplicar migrations em produção
```

### Documentação

- **Deploy produção:** `docs/SUPABASE_DEPLOY_PRODUCAO_GUIA.md`
- **Ambiente local Docker:** `docs/SUPABASE_LOCAL_DOCKER_GUIA.md`
- Scripts em `scripts/tests/v2_fase*.ts` são executados SEMPRE contra o banco local.
