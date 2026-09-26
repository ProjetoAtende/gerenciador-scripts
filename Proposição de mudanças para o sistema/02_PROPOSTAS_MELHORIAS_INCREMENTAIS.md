# 📈 Propostas de Melhorias Incrementais

**Data:** 9 de Janeiro de 2026  
**Tipo:** Melhorias evolutivas (não disruptivas)  
**Impacto:** Baixo a Médio  
**Esforço:** Baixo a Médio

---

## 📋 Índice

1. [Melhorias na Extração de Q&A](#1-melhorias-na-extração-de-qa)
2. [Otimização do Chunking](#2-otimização-do-chunking)
3. [Expansão do Dicionário de Sinônimos](#3-expansão-do-dicionário-de-sinônimos)
4. [Melhoria no Sistema de Feedback](#4-melhoria-no-sistema-de-feedback)
5. [Otimização do OCR](#5-otimização-do-ocr)
6. [Cache de Resultados](#6-cache-de-resultados)
7. [Resumo e Priorização](#7-resumo-e-priorização)

---

## 1. Melhorias na Extração de Q&A

### Problema Atual

O `qa_extractor.py` depende de padrões fixos (P:/R:, Pergunta:/Resposta:), resultando em poucos Q&A pairs sendo extraídos dos InfoEprocs.

### Proposta

Implementar **geração automática de Q&A** usando DeepSeek para criar perguntas a partir do conteúdo:

```python
# Proposta: qa_generator.py
class QAGenerator:
    """Gera Q&A pairs automaticamente usando IA"""
    
    def generate_qa_from_chunk(self, chunk: str, context: str) -> List[Dict]:
        """
        Usa DeepSeek para gerar perguntas relevantes
        """
        prompt = f"""
        Analise o seguinte trecho de documentação técnica e gere de 2 a 5 
        pares de pergunta/resposta que um usuário poderia fazer:
        
        CONTEXTO: {context}
        
        CONTEÚDO:
        {chunk}
        
        Formato de saída (JSON):
        [
            {{"pergunta": "...", "resposta": "..."}},
            ...
        ]
        
        Regras:
        - Perguntas devem ser naturais (como um usuário perguntaria)
        - Respostas devem ser completas mas concisas
        - Foque em procedimentos e soluções práticas
        """
        
        response = self._call_deepseek(prompt)
        return self._parse_qa_response(response)
```

### Benefícios

| Benefício | Impacto |
|-----------|---------|
| Mais Q&A pairs | +500% em perguntas indexadas |
| Linguagem natural | Melhor match com perguntas reais |
| Variações automáticas | Cobertura de sinônimos |

### Implementação

1. Criar `core/qa_generator.py`
2. Integrar no pipeline de processamento
3. Executar em batch para documentos existentes
4. Custo estimado: ~$5-10 em API DeepSeek

### Esforço: 🟢 Baixo (1-2 dias)

---

## 2. Otimização do Chunking

### Problema Atual

O chunking usa tamanho fixo (1000 caracteres) sem considerar a estrutura do documento, resultando em:
- Seções cortadas no meio
- Perda de contexto hierárquico
- Chunks sem sentido completo

### Proposta

Implementar **chunking semântico** que respeita a estrutura do documento:

```python
# Proposta: semantic_chunker.py
class SemanticChunker:
    """Chunking que respeita estrutura do documento"""
    
    def __init__(self):
        self.max_chunk_size = 1500  # Maior para manter contexto
        self.min_chunk_size = 200   # Mínimo para evitar fragmentos
    
    def chunk_by_sections(self, secoes: List[Dict]) -> List[Dict]:
        """
        Divide preservando estrutura hierárquica
        """
        chunks = []
        
        for secao in secoes:
            titulo = secao.get('titulo_secao', '')
            conteudo = secao.get('conteudo', '')
            nivel = secao.get('nivel', 1)
            
            # Se seção cabe inteira, manter inteira
            if len(conteudo) <= self.max_chunk_size:
                chunks.append({
                    'conteudo': conteudo,
                    'titulo_secao': titulo,
                    'contexto_hierarquico': self._build_hierarchy(secao),
                    'tipo_chunk': 'secao_completa'
                })
            else:
                # Dividir por parágrafos, não por caracteres
                paragrafos = self._split_paragraphs(conteudo)
                sub_chunks = self._group_paragraphs(paragrafos, self.max_chunk_size)
                
                for i, sub in enumerate(sub_chunks):
                    chunks.append({
                        'conteudo': sub,
                        'titulo_secao': f"{titulo} (Parte {i+1})",
                        'contexto_hierarquico': self._build_hierarchy(secao),
                        'tipo_chunk': 'secao_dividida'
                    })
        
        return chunks
    
    def _split_paragraphs(self, text: str) -> List[str]:
        """Divide texto em parágrafos naturais"""
        return [p.strip() for p in text.split('\n\n') if p.strip()]
    
    def _group_paragraphs(self, paragrafos: List[str], max_size: int) -> List[str]:
        """Agrupa parágrafos até atingir tamanho máximo"""
        groups = []
        current = []
        current_size = 0
        
        for p in paragrafos:
            if current_size + len(p) > max_size and current:
                groups.append('\n\n'.join(current))
                current = [p]
                current_size = len(p)
            else:
                current.append(p)
                current_size += len(p)
        
        if current:
            groups.append('\n\n'.join(current))
        
        return groups
```

### Benefícios

| Benefício | Impacto |
|-----------|---------|
| Contexto preservado | +30% em precisão de busca |
| Hierarquia mantida | Navegação mais intuitiva |
| Menos fragmentação | Respostas mais completas |

### Esforço: 🟡 Médio (2-3 dias)

---

## 3. Expansão do Dicionário de Sinônimos

### Problema Atual

O mapa de sinônimos em `useConsultaSmith.ts` é estático e limitado (~40 termos).

### Proposta

1. **Migrar sinônimos para banco de dados**
2. **Interface administrativa para gerenciamento**
3. **Aprendizado de sinônimos a partir de buscas**

```sql
-- Nova tabela para sinônimos
CREATE TABLE knowledge_base.sinonimos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    termo_principal TEXT NOT NULL,
    variacoes TEXT[] NOT NULL,
    categoria TEXT,  -- 'sistema', 'documento', 'acao', etc.
    frequencia_uso INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX idx_sinonimos_termo ON knowledge_base.sinonimos(termo_principal);
CREATE INDEX idx_sinonimos_variacoes ON knowledge_base.sinonimos USING GIN(variacoes);

-- Função para expandir query com sinônimos do banco
CREATE OR REPLACE FUNCTION knowledge_base.expandir_sinonimos(p_query TEXT)
RETURNS TEXT AS $$
DECLARE
    v_palavras TEXT[];
    v_resultado TEXT[];
    v_palavra TEXT;
    v_sinonimo RECORD;
BEGIN
    v_palavras := string_to_array(lower(p_query), ' ');
    v_resultado := v_palavras;
    
    FOREACH v_palavra IN ARRAY v_palavras
    LOOP
        -- Buscar sinônimos para esta palavra
        SELECT * INTO v_sinonimo 
        FROM knowledge_base.sinonimos 
        WHERE termo_principal = v_palavra 
           OR v_palavra = ANY(variacoes)
        LIMIT 1;
        
        IF FOUND THEN
            -- Adicionar termo principal e variações
            v_resultado := v_resultado || ARRAY[v_sinonimo.termo_principal];
            v_resultado := v_resultado || v_sinonimo.variacoes;
            
            -- Incrementar frequência de uso
            UPDATE knowledge_base.sinonimos 
            SET frequencia_uso = frequencia_uso + 1 
            WHERE id = v_sinonimo.id;
        END IF;
    END LOOP;
    
    -- Retornar query expandida (sem duplicatas)
    RETURN array_to_string(ARRAY(SELECT DISTINCT unnest(v_resultado)), ' ');
END;
$$ LANGUAGE plpgsql;
```

### Script de Migração dos Sinônimos Existentes

```sql
-- Migrar sinônimos atuais do código TypeScript
INSERT INTO knowledge_base.sinonimos (termo_principal, variacoes, categoria) VALUES
('eproc', ARRAY['e-proc', 'processo eletronico', 'sistema processual'], 'sistema'),
('pje', ARRAY['processo judicial eletronico', 'pje1g', 'pje2g'], 'sistema'),
('guia', ARRAY['boleto', 'documento arrecadacao', 'gru', 'dare'], 'documento'),
('certidão', ARRAY['certidao', 'documento', 'certidoes', 'atestado'], 'documento'),
('petição', ARRAY['peticao', 'requerimento', 'manifestacao'], 'documento'),
('cancelar', ARRAY['cancelamento', 'anular', 'excluir', 'estornar', 'baixar'], 'acao'),
('parcelar', ARRAY['parcelamento', 'dividir', 'fracionamento'], 'acao'),
('erro', ARRAY['falha', 'bug', 'problema', 'defeito', 'inconsistencia'], 'problema');
-- ... continuar com todos os sinônimos
```

### Benefícios

| Benefício | Impacto |
|-----------|---------|
| Sinônimos gerenciáveis | Fácil manutenção |
| Expansão automática | Cobertura crescente |
| Métricas de uso | Identificar gaps |

### Esforço: 🟡 Médio (2-3 dias)

---

## 4. Melhoria no Sistema de Feedback

### Problema Atual

O feedback (👍/👎) atualiza contadores mas não melhora as buscas futuras.

### Proposta

Implementar **feedback acionável**:

1. **Registrar query + resultado + feedback**
2. **Ajustar relevância de Q&A/segmentos baseado em feedback**
3. **Identificar gaps de conhecimento**

```sql
-- Tabela de feedback detalhado
CREATE TABLE knowledge_base.feedback_consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_original TEXT NOT NULL,
    query_preparada TEXT,
    resultados_ids UUID[], -- IDs dos resultados retornados
    resultado_clicado UUID, -- Qual resultado o usuário usou
    feedback BOOLEAN NOT NULL, -- true = positivo, false = negativo
    tempo_resposta_ms INTEGER,
    fontes_usadas TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para análise
CREATE INDEX idx_feedback_query ON knowledge_base.feedback_consultas(query_original);
CREATE INDEX idx_feedback_negativo ON knowledge_base.feedback_consultas(feedback) WHERE feedback = false;

-- Função para ajustar relevância baseado em feedback
CREATE OR REPLACE FUNCTION knowledge_base.aplicar_feedback_relevancia()
RETURNS void AS $$
BEGIN
    -- Aumentar relevância de Q&As com muitos feedbacks positivos
    UPDATE knowledge_base.qa_pairs q
    SET relevancia = LEAST(10, relevancia + 1)
    WHERE (q.avaliacao_positiva::float / NULLIF(q.vezes_retornada, 0)) > 0.8
      AND q.vezes_retornada >= 5;
    
    -- Diminuir relevância de Q&As com muitos feedbacks negativos
    UPDATE knowledge_base.qa_pairs q
    SET relevancia = GREATEST(1, relevancia - 1)
    WHERE (q.avaliacao_negativa::float / NULLIF(q.vezes_retornada, 0)) > 0.5
      AND q.vezes_retornada >= 5;
END;
$$ LANGUAGE plpgsql;

-- View para identificar gaps de conhecimento
CREATE VIEW knowledge_base.gaps_conhecimento AS
SELECT 
    query_original,
    COUNT(*) as total_buscas,
    SUM(CASE WHEN feedback = false THEN 1 ELSE 0 END) as feedbacks_negativos,
    AVG(CASE WHEN feedback THEN 1 ELSE 0 END) as taxa_satisfacao
FROM knowledge_base.feedback_consultas
GROUP BY query_original
HAVING COUNT(*) >= 3 
   AND AVG(CASE WHEN feedback THEN 1 ELSE 0 END) < 0.5
ORDER BY total_buscas DESC;
```

### Modificação no Frontend

```typescript
// useConsultaSmith.ts - Adicionar registro de feedback detalhado
const registrarFeedbackDetalhado = async (
  queryOriginal: string,
  queryPreparada: string,
  resultadosIds: string[],
  feedback: boolean,
  tempoMs: number,
  fontesUsadas: string[]
) => {
  try {
    await supabase.schema('knowledge_base').from('feedback_consultas').insert({
      query_original: queryOriginal,
      query_preparada: queryPreparada,
      resultados_ids: resultadosIds,
      feedback: feedback,
      tempo_resposta_ms: tempoMs,
      fontes_usadas: fontesUsadas,
    });
  } catch (e) {
    console.warn('Erro ao registrar feedback detalhado:', e);
  }
};
```

### Benefícios

| Benefício | Impacto |
|-----------|---------|
| Melhoria contínua | Busca fica melhor com uso |
| Identificar gaps | Priorizar conteúdo faltante |
| Métricas detalhadas | Decisões baseadas em dados |

### Esforço: 🟡 Médio (2-3 dias)

---

## 5. Otimização do OCR

### Problema Atual

O OCR (EasyOCR) leva 5-10 minutos por documento, sendo o principal gargalo.

### Proposta

1. **Cache de páginas já processadas**
2. **Processamento paralelo de páginas**
3. **Detecção inteligente de necessidade de OCR**

```python
# Proposta: optimized_ocr.py
import concurrent.futures
import hashlib
import json
from pathlib import Path

class OptimizedOCR:
    """OCR otimizado com cache e paralelização"""
    
    def __init__(self, cache_dir: Path = Path("data/ocr_cache")):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.reader = None  # Lazy loading
    
    def _get_reader(self):
        """Lazy load do EasyOCR (evita carregar se não precisar)"""
        if self.reader is None:
            import easyocr
            self.reader = easyocr.Reader(['pt'], gpu=False, verbose=False)
        return self.reader
    
    def _get_cache_key(self, image_bytes: bytes) -> str:
        """Gera hash único para a imagem"""
        return hashlib.md5(image_bytes).hexdigest()
    
    def _get_from_cache(self, cache_key: str) -> str | None:
        """Busca resultado no cache"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('text')
        return None
    
    def _save_to_cache(self, cache_key: str, text: str):
        """Salva resultado no cache"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump({'text': text}, f)
    
    def _needs_ocr(self, page_text: str) -> bool:
        """
        Detecta se a página precisa de OCR
        Se tem texto suficiente via extração normal, pula OCR
        """
        # Se tem menos de 50 caracteres, provavelmente é imagem
        if len(page_text.strip()) < 50:
            return True
        # Se tem muitos caracteres estranhos, pode ser extração ruim
        readable_chars = sum(1 for c in page_text if c.isalnum() or c.isspace())
        if readable_chars / len(page_text) < 0.7:
            return True
        return False
    
    def process_page_image(self, image_bytes: bytes) -> str:
        """Processa uma única imagem com cache"""
        cache_key = self._get_cache_key(image_bytes)
        
        # Tentar cache primeiro
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            return cached
        
        # Processar com OCR
        reader = self._get_reader()
        import numpy as np
        from PIL import Image
        import io
        
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        result = reader.readtext(np.array(image))
        text = " ".join([detection[1] for detection in result])
        
        # Salvar no cache
        self._save_to_cache(cache_key, text)
        
        return text
    
    def process_pdf_parallel(self, pdf_path: str, max_workers: int = 4) -> Dict[int, str]:
        """Processa PDF com OCR em paralelo"""
        import fitz
        
        doc = fitz.open(pdf_path)
        page_images = {}
        
        # Extrair imagens de cada página
        for page_num in range(len(doc)):
            page = doc[page_num]
            images = page.get_images()
            if images:
                page_images[page_num] = []
                for img in images:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    page_images[page_num].append(base_image["image"])
        
        doc.close()
        
        # Processar em paralelo
        results = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_page = {}
            
            for page_num, images in page_images.items():
                for img_bytes in images:
                    future = executor.submit(self.process_page_image, img_bytes)
                    future_to_page[future] = page_num
            
            for future in concurrent.futures.as_completed(future_to_page):
                page_num = future_to_page[future]
                text = future.result()
                if page_num not in results:
                    results[page_num] = []
                results[page_num].append(text)
        
        # Combinar textos por página
        return {
            page: " ".join(texts) 
            for page, texts in results.items()
        }
```

### Benefícios

| Benefício | Impacto |
|-----------|---------|
| Cache de OCR | -80% tempo em reprocessamento |
| Paralelização | -60% tempo em documentos novos |
| Detecção inteligente | Pula páginas sem imagem |

### Esforço: 🟡 Médio (2-3 dias)

---

## 6. Cache de Resultados

### Problema Atual

Cada consulta executa 3 buscas RPC mesmo para perguntas repetidas.

### Proposta

Implementar **cache de resultados** para consultas frequentes:

```typescript
// cache/queryCache.ts
interface CacheEntry {
  query: string;
  results: ResultadoBusca[];
  timestamp: number;
  ttl: number; // Time to live em ms
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 100;
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutos

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  get(query: string): ResultadoBusca[] | null {
    const key = this.normalizeQuery(query);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Verificar TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.results;
  }

  set(query: string, results: ResultadoBusca[], ttl?: number): void {
    const key = this.normalizeQuery(query);
    
    // Limpar cache se atingir tamanho máximo
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      query,
      results,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = key;
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  invalidate(pattern?: RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const queryCache = new QueryCache();
```

### Uso no Hook

```typescript
// useConsultaSmith.ts
import { queryCache } from '../cache/queryCache';

const consultar = async () => {
  // Verificar cache
  const cached = queryCache.get(pergunta);
  if (cached) {
    console.log('📦 Resultado do cache');
    // Ir direto para geração de resposta
    return gerarResposta(cached, pergunta);
  }
  
  // Busca normal...
  const resultados = await executarBuscas();
  
  // Salvar no cache
  queryCache.set(pergunta, resultados);
  
  return gerarResposta(resultados, pergunta);
};
```

### Benefícios

| Benefício | Impacto |
|-----------|---------|
| Resposta instantânea | -95% latência para queries repetidas |
| Menos carga no banco | -50% em queries RPC |
| Melhor UX | Resposta imediata |

### Esforço: 🟢 Baixo (1 dia)

---

## 7. Resumo e Priorização

### Matriz de Priorização

| Melhoria | Impacto | Esforço | Prioridade | Ordem |
|----------|---------|---------|------------|-------|
| Cache de Resultados | Alto | Baixo | 🔴 Alta | 1º |
| Geração de Q&A com IA | Alto | Baixo | 🔴 Alta | 2º |
| Sinônimos no Banco | Médio | Médio | 🟡 Média | 3º |
| Otimização do OCR | Médio | Médio | 🟡 Média | 4º |
| Chunking Semântico | Médio | Médio | 🟡 Média | 5º |
| Feedback Acionável | Médio | Médio | 🟡 Média | 6º |

### Cronograma Sugerido

```
Semana 1:
├── Cache de Resultados (1 dia)
├── Geração de Q&A com IA (2 dias)
└── Testes e Deploy (2 dias)

Semana 2:
├── Sinônimos no Banco (2 dias)
├── Migração dos sinônimos (1 dia)
└── Testes e Deploy (2 dias)

Semana 3:
├── Otimização do OCR (2 dias)
├── Reprocessamento de InfoEprocs (1 dia)
└── Testes e Deploy (2 dias)

Semana 4:
├── Chunking Semântico (2 dias)
├── Feedback Acionável (2 dias)
└── Testes Finais (1 dia)
```

### Estimativa de Resultados

Após implementação completa:

| Métrica | Atual | Esperado | Melhoria |
|---------|-------|----------|----------|
| Tempo de resposta (cache) | 2-5s | <0.5s | -90% |
| Q&A pairs | ~50 | ~500+ | +900% |
| Cobertura de sinônimos | ~40 termos | ~200+ termos | +400% |
| Tempo OCR | 5-10min | 2-4min | -60% |
| Taxa de satisfação | ~70% | ~85% | +15% |

---

**Próximo Documento:** [03_PROPOSTAS_DISRUPTIVAS.md](03_PROPOSTAS_DISRUPTIVAS.md)
