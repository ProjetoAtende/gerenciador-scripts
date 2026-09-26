# 📋 Plano de Implementação

**Data:** 9 de Janeiro de 2026  
**Versão:** 1.0  
**Objetivo:** Roadmap detalhado para evolução do sistema Smith

---

## 📋 Índice

1. [Visão Geral do Plano](#1-visão-geral-do-plano)
2. [Fase 1: Quick Wins](#2-fase-1-quick-wins)
3. [Fase 2: Busca Semântica](#3-fase-2-busca-semântica)
4. [Fase 3: Aprendizado e Otimização](#4-fase-3-aprendizado-e-otimização)
5. [Fase 4: Recursos Avançados](#5-fase-4-recursos-avançados)
6. [Métricas e KPIs](#6-métricas-e-kpis)
7. [Riscos e Mitigações](#7-riscos-e-mitigações)

---

## 1. Visão Geral do Plano

### Timeline Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ROADMAP DE IMPLEMENTAÇÃO                            │
│                                                                              │
│  Jan 2026              Fev 2026              Mar 2026              Abr 2026  │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │   FASE 1        │                                                        │
│  │   Quick Wins    │                                                        │
│  │   2 semanas     │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           └──────────►┌─────────────────────────┐                           │
│                       │      FASE 2             │                           │
│                       │   Busca Semântica       │                           │
│                       │      3 semanas          │                           │
│                       └───────────┬─────────────┘                           │
│                                   │                                          │
│                                   └──────────►┌─────────────────────────┐   │
│                                               │       FASE 3            │   │
│                                               │  Aprendizado Contínuo   │   │
│                                               │       4 semanas         │   │
│                                               └───────────┬─────────────┘   │
│                                                           │                  │
│  Mai 2026              Jun 2026              Jul 2026     │                  │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                           │                  │
│                                                           └────►┌───────────┐│
│                                                                 │  FASE 4   ││
│                                                                 │  Avançado ││
│                                                                 │  6+ sem   ││
│                                                                 └───────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Resumo das Fases

| Fase | Duração | Objetivo Principal | Entregáveis |
|------|---------|-------------------|-------------|
| **1** | 2 semanas | Quick wins | Cache, Q&A com IA, Sinônimos |
| **2** | 3 semanas | Busca semântica | Embeddings, Re-ranking |
| **3** | 4 semanas | Aprendizado | Feedback acionável, Fine-tuning |
| **4** | 6+ semanas | Recursos avançados | Knowledge Graph, Agente |

---

## 2. Fase 1: Quick Wins

### Objetivo
Implementar melhorias de alto impacto com baixo esforço que tragam resultados imediatos.

### Duração: 2 semanas

### Sprint 1 (Semana 1)

#### Dia 1-2: Cache de Resultados

**Tarefas:**
- [ ] Criar `src/cache/queryCache.ts`
- [ ] Implementar lógica de cache com TTL
- [ ] Integrar no `useConsultaSmith.ts`
- [ ] Adicionar invalidação por padrão
- [ ] Testar em desenvolvimento

**Código Base:**
```typescript
// src/cache/queryCache.ts
export class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize = 100;
  private defaultTTL = 5 * 60 * 1000; // 5 minutos
  
  // ... implementação completa no Doc 02
}

export const queryCache = new QueryCache();
```

**Critérios de Aceite:**
- [ ] Queries repetidas retornam em <100ms
- [ ] Cache expira corretamente após TTL
- [ ] Invalidação funciona ao atualizar base

---

#### Dia 3-5: Geração de Q&A com IA

**Tarefas:**
- [ ] Criar `smith-knowledge-processor/core/qa_generator.py`
- [ ] Implementar prompt para geração de Q&A
- [ ] Integrar no pipeline de processamento
- [ ] Criar script para processar documentos existentes
- [ ] Testar qualidade dos Q&As gerados

**Código Base:**
```python
# core/qa_generator.py
class QAGenerator:
    def generate_qa_from_chunk(self, chunk: str, context: str) -> List[Dict]:
        prompt = f"""
        Analise o seguinte trecho de documentação técnica e gere de 2 a 5 
        pares de pergunta/resposta que um usuário poderia fazer...
        """
        # ... implementação completa no Doc 02
```

**Script de Processamento em Batch:**
```bash
# Executar para todos os documentos existentes
python -m scripts.generate_qa_batch --all

# Executar para documento específico
python -m scripts.generate_qa_batch --doc-id <UUID>
```

**Critérios de Aceite:**
- [ ] Q&As gerados são naturais e relevantes
- [ ] Pelo menos 3 Q&As por chunk processado
- [ ] Integração automática no pipeline

---

### Sprint 2 (Semana 2)

#### Dia 6-8: Sinônimos no Banco de Dados

**Tarefas:**
- [ ] Criar tabela `knowledge_base.sinonimos`
- [ ] Criar função `knowledge_base.expandir_sinonimos()`
- [ ] Migrar sinônimos do código TypeScript
- [ ] Atualizar `useConsultaSmith.ts` para usar RPC
- [ ] Criar interface admin básica para gerenciamento

**SQL:**
```sql
-- Executar no Supabase
CREATE TABLE knowledge_base.sinonimos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    termo_principal TEXT NOT NULL UNIQUE,
    variacoes TEXT[] NOT NULL,
    categoria TEXT,
    frequencia_uso INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrar dados existentes
INSERT INTO knowledge_base.sinonimos (termo_principal, variacoes, categoria)
VALUES 
    ('eproc', ARRAY['e-proc', 'sistema eproc'], 'sistema'),
    ('guia', ARRAY['boleto', 'gru', 'dare'], 'documento'),
    -- ... mais sinônimos
;
```

**Critérios de Aceite:**
- [ ] Sinônimos migrados para banco
- [ ] Query é expandida automaticamente via RPC
- [ ] Frequência de uso é registrada

---

#### Dia 9-10: Testes e Deploy

**Tarefas:**
- [ ] Testes de integração completos
- [ ] Testes de performance (cache, busca)
- [ ] Documentação das mudanças
- [ ] Deploy em produção
- [ ] Monitoramento pós-deploy

**Checklist de Deploy:**
```
[ ] Backup do banco de dados
[ ] Executar migrations SQL
[ ] Deploy do Python (knowledge-processor)
[ ] Deploy do Frontend
[ ] Verificar logs de erro
[ ] Validar métricas de cache
[ ] Confirmar funcionamento em produção
```

---

### Entregáveis Fase 1

| Entregável | Status | Impacto |
|------------|--------|---------|
| Cache de queries | ⬜ | -90% latência em queries repetidas |
| Geração de Q&A | ⬜ | +500% em perguntas indexadas |
| Sinônimos no banco | ⬜ | Gerenciamento facilitado |

---

## 3. Fase 2: Busca Semântica

### Objetivo
Implementar busca vetorial com embeddings para capturar significado semântico.

### Duração: 3 semanas

### Sprint 3 (Semana 3)

#### Dia 11-13: Configuração de Infraestrutura

**Tarefas:**
- [ ] Habilitar extensão pgvector no Supabase
- [ ] Criar colunas de embedding nas tabelas
- [ ] Criar índices HNSW para busca vetorial
- [ ] Configurar API key da OpenAI (ou modelo local)

**SQL:**
```sql
-- Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Adicionar coluna de embedding em segmentos
ALTER TABLE knowledge_base.segmentos 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Criar índice HNSW
CREATE INDEX IF NOT EXISTS idx_segmentos_embedding 
ON knowledge_base.segmentos 
USING hnsw (embedding vector_cosine_ops);
```

---

#### Dia 14-15: Processador de Embeddings

**Tarefas:**
- [ ] Criar `smith-knowledge-processor/core/embedding_processor.py`
- [ ] Implementar geração de embeddings em batch
- [ ] Criar script para processar documentos existentes
- [ ] Estimar e validar custos

**Código:**
```python
# core/embedding_processor.py
import openai

class EmbeddingProcessor:
    def __init__(self, model: str = "text-embedding-3-small"):
        self.model = model
        self.client = openai.OpenAI()
    
    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        # Processar em batches de 100
        # ...
```

---

### Sprint 4 (Semana 4)

#### Dia 16-18: Função de Busca Híbrida

**Tarefas:**
- [ ] Criar função `knowledge_base.buscar_hibrido()`
- [ ] Implementar Reciprocal Rank Fusion
- [ ] Testar precisão da busca
- [ ] Ajustar pesos FTS vs Vetorial

**SQL:**
```sql
CREATE OR REPLACE FUNCTION knowledge_base.buscar_hibrido(
    p_query TEXT,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 10,
    p_peso_fts FLOAT DEFAULT 0.3,
    p_peso_vetor FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    tipo TEXT,
    titulo TEXT,
    conteudo TEXT,
    score_final FLOAT
) AS $$
-- ... implementação completa no Doc 03
$$ LANGUAGE plpgsql STABLE;
```

---

#### Dia 19-20: Integração no Frontend

**Tarefas:**
- [ ] Criar serviço de embeddings no frontend
- [ ] Atualizar `useConsultaSmith.ts` para usar busca híbrida
- [ ] Implementar fallback para FTS puro
- [ ] Testar end-to-end

**TypeScript:**
```typescript
// services/embeddingService.ts
export async function getQueryEmbedding(query: string): Promise<number[]> {
  const { data, error } = await supabase.rpc('gerar_embedding', {
    p_text: query
  });
  return data;
}
```

---

### Sprint 5 (Semana 5)

#### Dia 21-23: Re-ranking com Cohere

**Tarefas:**
- [ ] Configurar API key da Cohere
- [ ] Criar serviço de re-ranking
- [ ] Integrar no fluxo de consulta
- [ ] Medir impacto na precisão

**TypeScript:**
```typescript
// services/reranker.ts
export async function rerankDocuments(
  query: string,
  documents: string[],
  topN: number = 5
): Promise<RerankResult[]> {
  const response = await fetch('https://api.cohere.ai/v1/rerank', {
    // ...
  });
  // ...
}
```

---

#### Dia 24-25: Testes e Otimização

**Tarefas:**
- [ ] Benchmark de precisão (antes vs depois)
- [ ] Testes de performance (latência)
- [ ] Ajuste fino de pesos e parâmetros
- [ ] Documentação técnica
- [ ] Deploy em produção

**Métricas a Coletar:**
- Precisão@1, Precisão@3, Precisão@5
- Recall@10
- Latência média
- Custo por query

---

### Entregáveis Fase 2

| Entregável | Status | Impacto |
|------------|--------|---------|
| Embeddings vetoriais | ⬜ | +50% precisão semântica |
| Busca híbrida | ⬜ | Melhor cobertura |
| Re-ranking | ⬜ | +23% relevância Top 1 |

---

## 4. Fase 3: Aprendizado e Otimização

### Objetivo
Implementar sistema de feedback acionável e aprendizado contínuo básico.

### Duração: 4 semanas

### Sprint 6-7 (Semanas 6-7)

#### Feedback Acionável

**Tarefas:**
- [ ] Criar tabela `knowledge_base.feedback_consultas`
- [ ] Implementar registro detalhado de feedback
- [ ] Criar view `gaps_conhecimento`
- [ ] Atualizar frontend para enviar feedback completo
- [ ] Dashboard de análise de gaps

**Entregáveis:**
- Registro completo de cada consulta
- Identificação automática de queries problemáticas
- Relatório semanal de gaps

---

### Sprint 8-9 (Semanas 8-9)

#### Fine-tuning Básico

**Tarefas:**
- [ ] Criar pipeline de coleta de dados de treinamento
- [ ] Implementar fine-tuning de embeddings
- [ ] Configurar scheduler de retreinamento
- [ ] Testar impacto do fine-tuning

**Entregáveis:**
- Modelo de embeddings customizado
- Pipeline automatizado de retreinamento
- Métricas de melhoria contínua

---

### Entregáveis Fase 3

| Entregável | Status | Impacto |
|------------|--------|---------|
| Feedback acionável | ⬜ | Identificação de gaps |
| Dashboard de análise | ⬜ | Decisões baseadas em dados |
| Fine-tuning básico | ⬜ | +10-20% precisão ao longo do tempo |

---

## 5. Fase 4: Recursos Avançados

### Objetivo
Implementar recursos avançados como Knowledge Graph e Agente Autônomo.

### Duração: 6+ semanas

### Componentes

#### Knowledge Graph (Semanas 10-13)
- Instalação e configuração de Neo4j
- Extração de entidades e relações
- Integração com busca existente
- Interface de navegação

#### Agente Autônomo (Semanas 14-18)
- Definição de ferramentas disponíveis
- Implementação de tool calling
- Loop de execução do agente
- Integrações com sistemas externos
- Testes de segurança

---

## 6. Métricas e KPIs

### Dashboard de Métricas

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD SMITH - MÉTRICAS                        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  PERFORMANCE                                                    ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         ││
│  │  │ Latência Média│ │  Cache Hit    │ │ Queries/Dia   │         ││
│  │  │    1.2s       │ │    67%        │ │    450        │         ││
│  │  │   ▼ -40%      │ │   ▲ +67%      │ │   ▲ +15%      │         ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  QUALIDADE                                                      ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         ││
│  │  │ Satisfação    │ │  Precisão@1   │ │ Sem Resultado │         ││
│  │  │    82%        │ │    78%        │ │     8%        │         ││
│  │  │   ▲ +12%      │ │   ▲ +18%      │ │   ▼ -42%      │         ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  CONTEÚDO                                                       ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         ││
│  │  │  Documentos   │ │   Segmentos   │ │   Q&A Pairs   │         ││
│  │  │     75        │ │    22.500     │ │    3.400      │         ││
│  │  │   ▲ +5        │ │   ▲ +1.500    │ │   ▲ +3.000    │         ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘         ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### KPIs por Fase

#### Fase 1 - Quick Wins
| KPI | Baseline | Meta | Prazo |
|-----|----------|------|-------|
| Latência cache hit | N/A | <100ms | Semana 1 |
| Q&A pairs | ~50 | 500+ | Semana 2 |
| Sinônimos gerenciáveis | Não | Sim | Semana 2 |

#### Fase 2 - Busca Semântica
| KPI | Baseline | Meta | Prazo |
|-----|----------|------|-------|
| Precisão@1 | 60% | 85% | Semana 5 |
| Recall@10 | 70% | 95% | Semana 5 |
| Queries sem resultado | 15% | 5% | Semana 5 |

#### Fase 3 - Aprendizado
| KPI | Baseline | Meta | Prazo |
|-----|----------|------|-------|
| Satisfação (feedback positivo) | 70% | 85% | Semana 9 |
| Gaps identificados | 0 | 100% | Semana 7 |
| Melhoria contínua | 0% | +5%/mês | Semana 9 |

---

## 7. Riscos e Mitigações

### Matriz de Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Custo de APIs** exceder orçamento | Média | Alto | Usar modelos locais como fallback |
| **Performance** degradar com embeddings | Baixa | Alto | Índices HNSW otimizados + cache |
| **Qualidade** de Q&A gerados ruim | Média | Médio | Revisão manual + ajuste de prompts |
| **Downtime** durante migrações | Baixa | Alto | Deploy blue-green + rollback automático |
| **Dependência** de serviços externos | Média | Médio | Implementar fallbacks locais |

### Plano de Rollback

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PLANO DE ROLLBACK                               │
│                                                                      │
│  Se problema detectado:                                             │
│                                                                      │
│  1. REVERTER FRONTEND                                               │
│     git revert <commit-hash>                                        │
│     npm run deploy                                                  │
│                                                                      │
│  2. REVERTER BANCO (se necessário)                                  │
│     Restaurar backup pré-migração                                   │
│     Executar script de rollback SQL                                 │
│                                                                      │
│  3. FEATURE FLAGS                                                   │
│     Usar feature flags para desabilitar funcionalidades             │
│     sem deploy completo                                             │
│                                                                      │
│  4. COMUNICAR                                                        │
│     Notificar equipe sobre status                                   │
│     Documentar incidente                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Dependências Externas

| Serviço | Uso | Alternativa |
|---------|-----|-------------|
| OpenAI Embeddings | Vetorização de texto | SentenceTransformers (local) |
| Cohere Rerank | Re-ranking de resultados | Cross-Encoder (local) |
| DeepSeek | Geração de respostas | GPT-4 / Claude |
| Supabase | Banco de dados | PostgreSQL self-hosted |

---

## Próximos Passos Imediatos

### Semana 1 - Ações

1. **Segunda-feira**
   - [ ] Revisar e aprovar este plano
   - [ ] Configurar ambiente de desenvolvimento
   - [ ] Criar branch `feature/smith-v2`

2. **Terça-feira**
   - [ ] Implementar QueryCache
   - [ ] Testes unitários do cache

3. **Quarta-feira**
   - [ ] Implementar QAGenerator
   - [ ] Testes de geração de Q&A

4. **Quinta-feira**
   - [ ] Script de processamento em batch
   - [ ] Executar para 10 documentos de teste

5. **Sexta-feira**
   - [ ] Revisão de código
   - [ ] Ajustes baseados em feedback
   - [ ] Preparar para Sprint 2

---

**Documento Final:** [05_RESUMO_EXECUTIVO.md](05_RESUMO_EXECUTIVO.md)
