# 🚀 Propostas Disruptivas de Mudança

**Data:** 9 de Janeiro de 2026  
**Tipo:** Mudanças estruturais e arquiteturais  
**Impacto:** Alto  
**Esforço:** Alto

---

## 📋 Índice

1. [Implementação de Embeddings Semânticos](#1-implementação-de-embeddings-semânticos)
2. [RAG Avançado com Re-ranking](#2-rag-avançado-com-re-ranking)
3. [Sistema de Aprendizado Contínuo](#3-sistema-de-aprendizado-contínuo)
4. [Knowledge Graph](#4-knowledge-graph)
5. [Agente Autônomo Multi-step](#5-agente-autônomo-multi-step)
6. [Comparativo e Recomendações](#6-comparativo-e-recomendações)

---

## 1. Implementação de Embeddings Semânticos

### Problema Atual

O FTS (Full-Text Search) depende de correspondência lexical:
- **"Como faço para cancelar uma guia?"** não encontra **"Procedimento de estorno de boleto"**
- Sinônimos precisam ser cadastrados manualmente
- Não entende contexto ou intenção

### Proposta

Implementar **busca vetorial com embeddings** para capturar significado semântico:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA COM EMBEDDINGS                        │
│                                                                      │
│  ┌────────────────┐                                                 │
│  │  Documento     │                                                 │
│  │  (chunk)       │                                                 │
│  └───────┬────────┘                                                 │
│          │                                                          │
│          ▼                                                          │
│  ┌────────────────┐                                                 │
│  │  Embedding     │◄─── text-embedding-3-small (OpenAI)             │
│  │  Model         │     ou all-MiniLM-L6-v2 (local)                 │
│  └───────┬────────┘                                                 │
│          │                                                          │
│          ▼                                                          │
│  ┌────────────────┐                                                 │
│  │  [0.23, 0.45,  │                                                 │
│  │   -0.12, ...]  │◄─── Vetor 1536 ou 384 dimensões                 │
│  │  (embedding)   │                                                 │
│  └───────┬────────┘                                                 │
│          │                                                          │
│          ▼                                                          │
│  ┌────────────────┐                                                 │
│  │  pgvector      │◄─── Índice HNSW para busca rápida               │
│  │  (PostgreSQL)  │                                                 │
│  └────────────────┘                                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  BUSCA                                                          │ │
│  │                                                                 │ │
│  │  Query: "cancelar guia"                                         │ │
│  │         ↓                                                       │ │
│  │  Embedding Query: [0.21, 0.48, -0.15, ...]                      │ │
│  │         ↓                                                       │ │
│  │  Similaridade Coseno com todos os vetores                       │ │
│  │         ↓                                                       │ │
│  │  Resultados: "Procedimento de estorno de boleto" (0.89)         │ │
│  │              "Cancelamento de guia de pagamento" (0.87)         │ │
│  │              "Como solicitar reembolso" (0.82)                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementação Técnica

#### 1. Extensão pgvector no Supabase

```sql
-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Adicionar coluna de embedding nos segmentos
ALTER TABLE knowledge_base.segmentos 
ADD COLUMN embedding vector(1536);  -- Para OpenAI text-embedding-3-small

-- Índice HNSW para busca vetorial rápida
CREATE INDEX idx_segmentos_embedding 
ON knowledge_base.segmentos 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Adicionar embedding nos Q&A pairs
ALTER TABLE knowledge_base.qa_pairs 
ADD COLUMN embedding vector(1536);

CREATE INDEX idx_qa_embedding 
ON knowledge_base.qa_pairs 
USING hnsw (embedding vector_cosine_ops);
```

#### 2. Função de Busca Híbrida (FTS + Vetorial)

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
    score_fts FLOAT,
    score_vetor FLOAT,
    score_final FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH fts_results AS (
        -- Busca FTS tradicional
        SELECT 
            s.id,
            'segmento'::TEXT as tipo,
            s.titulo_secao as titulo,
            s.conteudo,
            ts_rank(s.search_vector, plainto_tsquery('portuguese', p_query)) as score
        FROM knowledge_base.segmentos s
        WHERE s.search_vector @@ plainto_tsquery('portuguese', p_query)
    ),
    vector_results AS (
        -- Busca vetorial
        SELECT 
            s.id,
            'segmento'::TEXT as tipo,
            s.titulo_secao as titulo,
            s.conteudo,
            1 - (s.embedding <=> p_query_embedding) as score  -- Similaridade coseno
        FROM knowledge_base.segmentos s
        WHERE s.embedding IS NOT NULL
        ORDER BY s.embedding <=> p_query_embedding
        LIMIT p_limit * 3  -- Pegar mais candidatos
    ),
    combined AS (
        -- Combinar resultados com Reciprocal Rank Fusion
        SELECT 
            COALESCE(f.id, v.id) as id,
            COALESCE(f.tipo, v.tipo) as tipo,
            COALESCE(f.titulo, v.titulo) as titulo,
            COALESCE(f.conteudo, v.conteudo) as conteudo,
            COALESCE(f.score, 0) as score_fts,
            COALESCE(v.score, 0) as score_vetor,
            -- Score híbrido ponderado
            (COALESCE(f.score, 0) * p_peso_fts) + 
            (COALESCE(v.score, 0) * p_peso_vetor) as score_final
        FROM fts_results f
        FULL OUTER JOIN vector_results v ON f.id = v.id
    )
    SELECT * FROM combined
    ORDER BY score_final DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

#### 3. Processador de Embeddings (Python)

```python
# embedding_processor.py
import openai
from typing import List
import numpy as np

class EmbeddingProcessor:
    """Gera e gerencia embeddings para documentos"""
    
    def __init__(self, model: str = "text-embedding-3-small"):
        self.model = model
        self.client = openai.OpenAI()
        self.batch_size = 100  # OpenAI permite até 2048
    
    def generate_embedding(self, text: str) -> List[float]:
        """Gera embedding para um texto"""
        response = self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding
    
    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Gera embeddings em batch (mais eficiente)"""
        embeddings = []
        
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            response = self.client.embeddings.create(
                input=batch,
                model=self.model
            )
            embeddings.extend([d.embedding for d in response.data])
        
        return embeddings
    
    def update_document_embeddings(self, documento_id: str):
        """Atualiza embeddings de todos os segmentos de um documento"""
        from config import supabase
        
        # Buscar segmentos sem embedding
        response = supabase.schema("knowledge_base").table("segmentos").select(
            "id, conteudo, titulo_secao"
        ).eq("documento_id", documento_id).is_("embedding", "null").execute()
        
        if not response.data:
            print("Nenhum segmento para processar")
            return
        
        segmentos = response.data
        print(f"Processando {len(segmentos)} segmentos...")
        
        # Preparar textos (título + conteúdo para melhor contexto)
        texts = [
            f"{s.get('titulo_secao', '')} {s.get('conteudo', '')}"
            for s in segmentos
        ]
        
        # Gerar embeddings em batch
        embeddings = self.generate_batch_embeddings(texts)
        
        # Atualizar no banco
        for seg, emb in zip(segmentos, embeddings):
            supabase.schema("knowledge_base").table("segmentos").update({
                "embedding": emb
            }).eq("id", seg["id"]).execute()
        
        print(f"✅ {len(segmentos)} embeddings atualizados")
```

### Custos Estimados

| Item | Custo |
|------|-------|
| OpenAI text-embedding-3-small | $0.02 / 1M tokens |
| ~70 InfoEprocs (~500 chunks cada) | ~$0.50 total inicial |
| Manutenção mensal | ~$0.10/mês |

### Alternativa Local (Sem Custo de API)

```python
# local_embeddings.py
from sentence_transformers import SentenceTransformer

class LocalEmbeddingProcessor:
    """Embeddings locais sem custo de API"""
    
    def __init__(self):
        # Modelo multilíngue leve (384 dimensões)
        self.model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    
    def generate_embedding(self, text: str) -> List[float]:
        return self.model.encode(text).tolist()
    
    def generate_batch(self, texts: List[str]) -> List[List[float]]:
        return self.model.encode(texts).tolist()
```

### Impacto Esperado

| Métrica | Antes (FTS) | Depois (Híbrido) | Melhoria |
|---------|-------------|------------------|----------|
| Precisão em buscas semânticas | ~60% | ~90% | +50% |
| Recall (cobertura) | ~70% | ~95% | +35% |
| Necessidade de sinônimos | Alta | Baixa | -80% |

### Esforço: 🔴 Alto (1-2 semanas)

---

## 2. RAG Avançado com Re-ranking

### Problema Atual

O sistema atual usa ranking simples baseado em scores de FTS/Trigram. Resultados podem não ser os mais relevantes para a pergunta específica.

### Proposta

Implementar **Re-ranking com Cross-Encoder** para refinar resultados:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      RAG COM RE-RANKING                              │
│                                                                      │
│  Query: "Como cancelar guia de custas?"                             │
│         ↓                                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  1ª FASE: Retrieval Inicial (Rápido)                           │ │
│  │  - Busca FTS + Vetorial                                        │ │
│  │  - Retorna Top 20 candidatos                                   │ │
│  │  - Tempo: ~50ms                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│         ↓                                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  2ª FASE: Re-ranking (Preciso)                                 │ │
│  │  - Cross-Encoder analisa (query, documento) juntos             │ │
│  │  - Score de relevância mais preciso                            │ │
│  │  - Retorna Top 5 re-ranqueados                                 │ │
│  │  - Tempo: ~200ms                                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│         ↓                                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  3ª FASE: Geração de Resposta                                  │ │
│  │  - Contexto mais relevante → Resposta mais precisa             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementação com Cohere Rerank

```typescript
// reranker.ts
interface RerankResult {
  document: string;
  relevance_score: number;
  index: number;
}

async function rerankDocuments(
  query: string,
  documents: string[],
  topN: number = 5
): Promise<RerankResult[]> {
  const response = await fetch('https://api.cohere.ai/v1/rerank', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'rerank-multilingual-v3.0',
      query: query,
      documents: documents,
      top_n: topN,
      return_documents: true,
    }),
  });

  const data = await response.json();
  return data.results;
}

// Uso no useConsultaSmith.ts
const consultarComRerank = async () => {
  // 1. Busca inicial (mais candidatos)
  const candidatos = await buscarCandidatos(queryPreparada, 20);
  
  // 2. Re-rank com Cohere
  const documentos = candidatos.map(c => c.conteudo);
  const reranked = await rerankDocuments(pergunta, documentos, 5);
  
  // 3. Reordenar resultados
  const resultadosFinais = reranked.map(r => ({
    ...candidatos[r.index],
    relevancia: r.relevance_score
  }));
  
  // 4. Gerar resposta com contexto otimizado
  return gerarResposta(resultadosFinais, pergunta);
};
```

### Alternativa Local com Cross-Encoder

```python
# cross_encoder_reranker.py
from sentence_transformers import CrossEncoder

class LocalReranker:
    """Re-ranker local sem custo de API"""
    
    def __init__(self):
        # Modelo multilíngue
        self.model = CrossEncoder('cross-encoder/mmarco-mMiniLMv2-L12-H384-v1')
    
    def rerank(self, query: str, documents: List[str], top_n: int = 5) -> List[dict]:
        # Criar pares (query, documento)
        pairs = [[query, doc] for doc in documents]
        
        # Calcular scores
        scores = self.model.predict(pairs)
        
        # Ordenar por score
        ranked = sorted(
            zip(range(len(documents)), documents, scores),
            key=lambda x: x[2],
            reverse=True
        )[:top_n]
        
        return [
            {'index': idx, 'document': doc, 'score': float(score)}
            for idx, doc, score in ranked
        ]
```

### Impacto Esperado

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Relevância do Top 1 | ~75% | ~92% | +23% |
| Qualidade da resposta | ~70% | ~88% | +25% |
| Tempo de resposta | 2-3s | 2.5-4s | +500ms |

### Esforço: 🟡 Médio (3-5 dias)

---

## 3. Sistema de Aprendizado Contínuo

### Problema Atual

O sistema não aprende com o uso. Feedbacks são registrados mas não melhoram as buscas.

### Proposta

Implementar **Fine-tuning contínuo** e **Active Learning**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                   CICLO DE APRENDIZADO CONTÍNUO                      │
│                                                                      │
│  ┌────────────────┐                                                 │
│  │  Consulta do   │                                                 │
│  │  Usuário       │                                                 │
│  └───────┬────────┘                                                 │
│          │                                                          │
│          ▼                                                          │
│  ┌────────────────┐      ┌────────────────┐                        │
│  │  Busca +       │      │  Modelo        │                        │
│  │  Resposta      │◄─────│  Atualizado    │                        │
│  └───────┬────────┘      └────────▲───────┘                        │
│          │                        │                                 │
│          ▼                        │                                 │
│  ┌────────────────┐              │                                 │
│  │  Feedback      │              │                                 │
│  │  do Usuário    │              │                                 │
│  └───────┬────────┘              │                                 │
│          │                        │                                 │
│          ▼                        │                                 │
│  ┌────────────────┐              │                                 │
│  │  Análise de    │              │                                 │
│  │  Feedback      │              │                                 │
│  └───────┬────────┘              │                                 │
│          │                        │                                 │
│          ▼                        │                                 │
│  ┌────────────────┐              │                                 │
│  │  Dados de      │──────────────┘                                 │
│  │  Treinamento   │                                                 │
│  └────────────────┘                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Componentes

#### 1. Coletor de Dados de Treinamento

```sql
-- Tabela para dados de treinamento
CREATE TABLE knowledge_base.training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Query e contexto
    query TEXT NOT NULL,
    query_embedding vector(1536),
    
    -- Resultado selecionado (positivo)
    positive_doc_id UUID,
    positive_content TEXT,
    positive_embedding vector(1536),
    
    -- Resultados ignorados (negativos)
    negative_doc_ids UUID[],
    
    -- Metadados
    feedback_score INTEGER,  -- 1-5
    response_used BOOLEAN,   -- Se a resposta foi usada
    time_spent_ms INTEGER,   -- Tempo que usuário passou lendo
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Função para gerar dataset de treinamento
CREATE OR REPLACE FUNCTION knowledge_base.gerar_dataset_treinamento()
RETURNS TABLE (
    query TEXT,
    positive TEXT,
    negative TEXT,
    score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.query,
        t.positive_content as positive,
        s.conteudo as negative,
        (t.feedback_score::float / 5.0) as score
    FROM knowledge_base.training_data t
    CROSS JOIN LATERAL (
        -- Pegar um resultado negativo aleatório
        SELECT conteudo 
        FROM knowledge_base.segmentos 
        WHERE id = ANY(t.negative_doc_ids)
        ORDER BY random()
        LIMIT 1
    ) s
    WHERE t.feedback_score >= 4;  -- Apenas feedbacks positivos
END;
$$ LANGUAGE plpgsql;
```

#### 2. Pipeline de Fine-tuning

```python
# fine_tuning_pipeline.py
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

class ContinuousLearningPipeline:
    """Pipeline de fine-tuning contínuo"""
    
    def __init__(self, base_model: str = 'paraphrase-multilingual-MiniLM-L12-v2'):
        self.model = SentenceTransformer(base_model)
        self.min_samples = 100  # Mínimo para retreinar
        self.training_interval_days = 7
    
    def collect_training_data(self) -> List[InputExample]:
        """Coleta dados de treinamento do banco"""
        from config import supabase
        
        response = supabase.schema("knowledge_base").rpc(
            "gerar_dataset_treinamento", {}
        ).execute()
        
        examples = []
        for row in response.data:
            examples.append(InputExample(
                texts=[row['query'], row['positive']],
                label=row['score']
            ))
            # Adicionar exemplo negativo
            examples.append(InputExample(
                texts=[row['query'], row['negative']],
                label=0.0
            ))
        
        return examples
    
    def should_retrain(self) -> bool:
        """Verifica se deve retreinar"""
        from config import supabase
        
        # Contar novos dados desde último treino
        response = supabase.schema("knowledge_base").from_("training_data").select(
            "count"
        ).gte(
            "created_at", 
            self._get_last_training_date()
        ).execute()
        
        return response.data[0]['count'] >= self.min_samples
    
    def retrain(self):
        """Executa fine-tuning incremental"""
        examples = self.collect_training_data()
        
        if len(examples) < self.min_samples:
            print(f"Dados insuficientes: {len(examples)} < {self.min_samples}")
            return
        
        # Preparar dataloader
        train_dataloader = DataLoader(
            examples, 
            shuffle=True, 
            batch_size=16
        )
        
        # Loss function para similaridade
        train_loss = losses.CosineSimilarityLoss(self.model)
        
        # Fine-tuning
        self.model.fit(
            train_objectives=[(train_dataloader, train_loss)],
            epochs=3,
            warmup_steps=100,
            output_path='models/smith_finetuned',
            show_progress_bar=True
        )
        
        print("✅ Modelo atualizado!")
        
        # Regenerar embeddings com novo modelo
        self._regenerate_embeddings()
    
    def _regenerate_embeddings(self):
        """Regenera todos os embeddings com modelo atualizado"""
        # Implementar regeneração em batch
        pass
```

#### 3. Scheduler de Treinamento

```python
# scheduler.py
import schedule
import time

def setup_continuous_learning():
    """Configura jobs de aprendizado contínuo"""
    
    pipeline = ContinuousLearningPipeline()
    
    # Verificar semanalmente se deve retreinar
    schedule.every().sunday.at("03:00").do(
        lambda: pipeline.retrain() if pipeline.should_retrain() else None
    )
    
    # Loop de execução
    while True:
        schedule.run_pending()
        time.sleep(3600)  # Verificar a cada hora
```

### Impacto Esperado

| Métrica | Mês 1 | Mês 3 | Mês 6 |
|---------|-------|-------|-------|
| Precisão de busca | 85% | 90% | 95% |
| Satisfação do usuário | 75% | 85% | 92% |
| Consultas sem resultado | 15% | 8% | 3% |

### Esforço: 🔴 Alto (2-3 semanas)

---

## 4. Knowledge Graph

### Problema Atual

Documentos são tratados como chunks isolados, perdendo relações entre conceitos.

### Proposta

Implementar **Grafo de Conhecimento** para capturar relações:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE GRAPH                                 │
│                                                                      │
│     ┌─────────────┐                                                 │
│     │   e-Proc    │                                                 │
│     └──────┬──────┘                                                 │
│            │ TEM_FUNCIONALIDADE                                     │
│     ┌──────┴──────┬───────────────┬───────────────┐                │
│     ▼             ▼               ▼               ▼                │
│ ┌─────────┐ ┌─────────┐   ┌─────────────┐   ┌─────────┐           │
│ │ Petição │ │  Guia   │   │ Intimação   │   │Certidão │           │
│ └────┬────┘ └────┬────┘   └──────┬──────┘   └────┬────┘           │
│      │           │               │                │                 │
│      │ PODE_SER  │ PODE_SER      │ GERA           │ TEM_TIPO       │
│      │           │               │                │                 │
│      ▼           ▼               ▼                ▼                 │
│ ┌─────────┐ ┌─────────┐   ┌─────────────┐   ┌─────────┐           │
│ │Cancelada│ │Estornada│   │   Prazo     │   │ Criminal│           │
│ └─────────┘ └─────────┘   └──────┬──────┘   │  Cível  │           │
│                                  │           └─────────┘           │
│                           AFETA  │                                  │
│                                  ▼                                  │
│                          ┌─────────────┐                           │
│                          │   Parte     │                           │
│                          │ (Advogado)  │                           │
│                          └─────────────┘                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  CONSULTA: "O que acontece quando uma intimação não é lida?"   │ │
│  │                                                                 │ │
│  │  Caminho no grafo:                                              │ │
│  │  Intimação → GERA → Prazo → AFETA → Parte                       │ │
│  │                                                                 │ │
│  │  Resposta enriquecida com contexto das relações                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementação com Neo4j

```python
# knowledge_graph.py
from neo4j import GraphDatabase

class KnowledgeGraph:
    """Gerencia grafo de conhecimento"""
    
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def add_concept(self, name: str, tipo: str, properties: dict = None):
        """Adiciona conceito ao grafo"""
        with self.driver.session() as session:
            query = """
            MERGE (c:Concept {name: $name, type: $tipo})
            SET c += $properties
            RETURN c
            """
            session.run(query, name=name, tipo=tipo, properties=properties or {})
    
    def add_relation(self, from_concept: str, to_concept: str, relation: str):
        """Adiciona relação entre conceitos"""
        with self.driver.session() as session:
            query = f"""
            MATCH (a:Concept {{name: $from_name}})
            MATCH (b:Concept {{name: $to_name}})
            MERGE (a)-[r:{relation}]->(b)
            RETURN a, r, b
            """
            session.run(query, from_name=from_concept, to_name=to_concept)
    
    def find_related_concepts(self, concept: str, depth: int = 2) -> List[dict]:
        """Encontra conceitos relacionados até N níveis"""
        with self.driver.session() as session:
            query = """
            MATCH path = (c:Concept {name: $name})-[*1..$depth]-(related)
            RETURN DISTINCT related.name as name, 
                   related.type as type,
                   length(path) as distance
            ORDER BY distance
            """
            result = session.run(query, name=concept, depth=depth)
            return [dict(record) for record in result]
    
    def enrich_query(self, query: str) -> str:
        """Enriquece query com conceitos relacionados"""
        # Extrair conceitos da query (via NER ou keywords)
        concepts = self._extract_concepts(query)
        
        # Buscar conceitos relacionados
        related = []
        for concept in concepts:
            related.extend(self.find_related_concepts(concept, depth=1))
        
        # Adicionar termos relacionados à query
        related_terms = [r['name'] for r in related if r['distance'] == 1]
        
        return query + ' ' + ' '.join(related_terms)
```

### Extração Automática de Entidades e Relações

```python
# entity_extractor.py
import openai

class EntityRelationExtractor:
    """Extrai entidades e relações de documentos usando LLM"""
    
    def extract_from_chunk(self, chunk: str) -> dict:
        """Extrai entidades e relações de um chunk"""
        prompt = f"""
        Analise o seguinte texto técnico-jurídico e extraia:
        1. ENTIDADES: Conceitos principais (sistemas, documentos, ações, pessoas)
        2. RELAÇÕES: Como as entidades se relacionam
        
        Texto:
        {chunk}
        
        Formato de saída (JSON):
        {{
            "entities": [
                {{"name": "e-Proc", "type": "sistema"}},
                {{"name": "Petição", "type": "documento"}}
            ],
            "relations": [
                {{"from": "e-Proc", "to": "Petição", "relation": "PERMITE_CRIAR"}}
            ]
        }}
        """
        
        response = openai.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
```

### Impacto Esperado

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Respostas contextuais | 60% | 85% | +42% |
| Navegação de conceitos | N/A | Disponível | Novo |
| Descoberta de conhecimento | Baixa | Alta | +100% |

### Esforço: 🔴 Alto (3-4 semanas)

---

## 5. Agente Autônomo Multi-step

### Problema Atual

O sistema responde perguntas simples, mas não consegue:
- Seguir procedimentos passo-a-passo
- Tomar ações no sistema
- Verificar se a solução funcionou

### Proposta

Implementar **Agente com Tool Use** para ações complexas:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AGENTE AUTÔNOMO SMITH                           │
│                                                                      │
│  Pergunta: "Preciso cancelar a guia 123456 e emitir uma nova"       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  PLANEJAMENTO (DeepSeek)                                       │ │
│  │                                                                 │ │
│  │  1. Buscar procedimento de cancelamento de guia               │ │
│  │  2. Identificar informações necessárias                       │ │
│  │  3. Verificar status atual da guia 123456                     │ │
│  │  4. Executar cancelamento                                      │ │
│  │  5. Emitir nova guia                                          │ │
│  │  6. Confirmar sucesso                                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  FERRAMENTAS DISPONÍVEIS                                       │ │
│  │                                                                 │ │
│  │  🔍 buscar_conhecimento(query) - Busca na base de conhecimento │ │
│  │  📋 buscar_chamados(query) - Busca chamados similares          │ │
│  │  🔎 verificar_guia(numero) - Consulta status de guia           │ │
│  │  ❌ cancelar_guia(numero, motivo) - Cancela guia               │ │
│  │  ➕ emitir_guia(dados) - Emite nova guia                       │ │
│  │  📧 enviar_email(destino, assunto, corpo) - Notifica usuário   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  EXECUÇÃO                                                       │ │
│  │                                                                 │ │
│  │  Step 1: buscar_conhecimento("cancelar guia custas")           │ │
│  │  → Resultado: Procedimento encontrado                          │ │
│  │                                                                 │ │
│  │  Step 2: verificar_guia("123456")                              │ │
│  │  → Resultado: Guia em aberto, valor R$ 150,00                  │ │
│  │                                                                 │ │
│  │  Step 3: cancelar_guia("123456", "Solicitação do usuário")     │ │
│  │  → Resultado: Cancelada com sucesso                            │ │
│  │                                                                 │ │
│  │  Step 4: emitir_guia({...})                                    │ │
│  │  → Resultado: Nova guia 123457 emitida                         │ │
│  │                                                                 │ │
│  │  Step 5: Gerar resposta final para usuário                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementação com Function Calling

```typescript
// agent/smithAgent.ts
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: any) => Promise<any>;
}

const tools: Tool[] = [
  {
    name: 'buscar_conhecimento',
    description: 'Busca informações na base de conhecimento do Smith',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca' }
      },
      required: ['query']
    },
    execute: async (params) => {
      const results = await supabase.schema('knowledge_base')
        .rpc('buscar_conhecimento', { p_query: params.query, p_limit: 3 });
      return results.data;
    }
  },
  {
    name: 'verificar_guia',
    description: 'Verifica status de uma guia de custas',
    parameters: {
      type: 'object',
      properties: {
        numero: { type: 'string', description: 'Número da guia' }
      },
      required: ['numero']
    },
    execute: async (params) => {
      // Integração com sistema de guias
      return await verificarGuiaAPI(params.numero);
    }
  },
  // ... mais ferramentas
];

class SmithAgent {
  private maxSteps = 10;
  private tools: Tool[];
  
  constructor(tools: Tool[]) {
    this.tools = tools;
  }
  
  async run(userQuery: string): Promise<AgentResponse> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `Você é o Agente Smith, um assistente autônomo capaz de 
        executar ações para resolver problemas. Use as ferramentas disponíveis
        para completar tarefas. Pense passo a passo.`
      },
      { role: 'user', content: userQuery }
    ];
    
    for (let step = 0; step < this.maxSteps; step++) {
      const response = await this.callLLM(messages, this.tools);
      
      if (response.finishReason === 'stop') {
        // Agente terminou
        return {
          success: true,
          response: response.content,
          steps: messages.filter(m => m.role === 'assistant').length
        };
      }
      
      if (response.toolCalls) {
        // Executar ferramentas
        for (const call of response.toolCalls) {
          const tool = this.tools.find(t => t.name === call.name);
          if (tool) {
            const result = await tool.execute(call.arguments);
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              toolCallId: call.id
            });
          }
        }
      }
    }
    
    return {
      success: false,
      error: 'Máximo de passos atingido'
    };
  }
}
```

### Impacto Esperado

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Tarefas automatizáveis | 0% | 40% | +40% |
| Tempo de resolução | 15min | 2min | -87% |
| Satisfação do usuário | 75% | 95% | +27% |

### Esforço: 🔴 Alto (4-6 semanas)

---

## 6. Comparativo e Recomendações

### Matriz de Comparação

| Proposta | Impacto | Esforço | Risco | ROI | Prioridade |
|----------|---------|---------|-------|-----|------------|
| Embeddings Semânticos | 🔴 Alto | 🔴 Alto | 🟡 Médio | Alto | ⭐⭐⭐ |
| RAG com Re-ranking | 🟡 Médio | 🟡 Médio | 🟢 Baixo | Alto | ⭐⭐⭐⭐ |
| Aprendizado Contínuo | 🔴 Alto | 🔴 Alto | 🟡 Médio | Muito Alto | ⭐⭐⭐ |
| Knowledge Graph | 🟡 Médio | 🔴 Alto | 🔴 Alto | Médio | ⭐⭐ |
| Agente Autônomo | 🔴 Alto | 🔴 Alto | 🔴 Alto | Muito Alto | ⭐⭐ |

### Recomendação de Implementação

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ROADMAP RECOMENDADO                             │
│                                                                      │
│  FASE 1 (Mês 1-2): Fundação                                         │
│  ├── Embeddings Semânticos                                          │
│  └── RAG com Re-ranking                                             │
│                                                                      │
│  FASE 2 (Mês 3-4): Otimização                                       │
│  ├── Aprendizado Contínuo (básico)                                  │
│  └── Melhorias incrementais (Doc 02)                                │
│                                                                      │
│  FASE 3 (Mês 5-6): Expansão                                         │
│  ├── Knowledge Graph (piloto)                                       │
│  └── Agente Autônomo (protótipo)                                    │
│                                                                      │
│  FASE 4 (Mês 7+): Maturidade                                        │
│  ├── Aprendizado Contínuo (avançado)                                │
│  ├── Agente Autônomo (produção)                                     │
│  └── Integrações externas                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Custos Estimados

| Item | Custo Mensal | Custo Anual |
|------|--------------|-------------|
| OpenAI Embeddings | ~$5 | ~$60 |
| Cohere Rerank | ~$50 | ~$600 |
| Neo4j (se usar) | ~$0 (self-hosted) | ~$0 |
| Compute adicional | ~$20 | ~$240 |
| **Total** | **~$75** | **~$900** |

### Conclusão

A implementação de **Embeddings Semânticos + Re-ranking** oferece o melhor custo-benefício inicial, com potencial de melhorar significativamente a precisão das buscas sem mudanças drásticas na arquitetura.

O **Sistema de Aprendizado Contínuo** deve ser priorizado em seguida, pois cria um ciclo virtuoso onde o sistema melhora automaticamente com o uso.

As propostas de **Knowledge Graph** e **Agente Autônomo** são mais ambiciosas e devem ser consideradas para fases futuras, quando a base do sistema estiver mais madura.

---

**Próximo Documento:** [04_PLANO_IMPLEMENTACAO.md](04_PLANO_IMPLEMENTACAO.md)
