# 🔍 Análise Completa do Sistema Smith

**Data da Análise:** 9 de Janeiro de 2026  
**Versão do Documento:** 1.0  
**Objetivo:** Documentar o funcionamento atual do componente Smith e identificar oportunidades de melhoria

---

## 📋 Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura Atual](#2-arquitetura-atual)
3. [Componentes Principais](#3-componentes-principais)
4. [Fluxo de Dados](#4-fluxo-de-dados)
5. [Fontes de Conhecimento](#5-fontes-de-conhecimento)
6. [Pontos Fortes Identificados](#6-pontos-fortes-identificados)
7. [Limitações e Gargalos](#7-limitações-e-gargalos)
8. [Conclusões](#8-conclusões)

---

## 1. Visão Geral do Sistema

### O que é o Smith?

O **Agente Smith** é um sistema de busca inteligente que atua como um assistente para responder chamados técnicos. Ele consulta múltiplas fontes de conhecimento simultaneamente e gera respostas contextualizadas usando IA (DeepSeek).

### Propósito Principal

- Fornecer respostas rápidas e precisas para dúvidas técnicas
- Agregar conhecimento de múltiplas fontes em uma única interface
- Reduzir tempo de resolução de chamados
- Aproveitar histórico de soluções anteriores

### Público-Alvo

- Atendentes de suporte técnico
- Operadores de chamados
- Equipe de TI do TJSP

---

## 2. Arquitetura Atual

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React/TypeScript)                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  ConsultaContent.tsx                                              │   │
│  │  - Interface de chat com avatares Matrix                          │   │
│  │  - Filtros de busca por fonte                                     │   │
│  │  - Histórico de conversas                                         │   │
│  └───────────────────────────────┬──────────────────────────────────┘   │
│                                  │                                       │
│  ┌───────────────────────────────▼──────────────────────────────────┐   │
│  │  useConsultaSmith.ts (Hook Principal)                            │   │
│  │  - Preparação de query (sinônimos, normalização)                 │   │
│  │  - Busca paralela em múltiplas fontes                            │   │
│  │  - Normalização e ranking de resultados                          │   │
│  │  - Geração de prompt para DeepSeek                               │   │
│  │  - Gestão de feedback                                            │   │
│  └───────────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE (PostgreSQL)                          │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ Schema PUBLIC  │  │ Schema ORACULO │  │ Schema KNOWLEDGE_BASE      │ │
│  ├────────────────┤  ├────────────────┤  ├────────────────────────────┤ │
│  │ • Scripts      │  │ • chamados     │  │ • documentos               │ │
│  │ • Grupos       │  │ • FTS vectors  │  │ • segmentos (chunks)       │ │
│  │ • Subpastas    │  │ • Trigram      │  │ • qa_pairs                 │ │
│  │                │  │                │  │ • FTS + Trigram            │ │
│  └────────────────┘  └────────────────┘  └────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  FUNÇÕES RPC                                                      │   │
│  │  • buscar_scripts_smith() - FTS em scripts                        │   │
│  │  • buscar_chamados() - Busca híbrida no Oráculo                   │   │
│  │  • buscar_conhecimento() - FTS em InfoEprocs                      │   │
│  │  • chamar_deepseek() - Proxy para IA                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SMITH KNOWLEDGE PROCESSOR (Python)                  │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ │
│  │  Extractors    │  │  Core          │  │  Robots                    │ │
│  ├────────────────┤  ├────────────────┤  ├────────────────────────────┤ │
│  │ • PDF (+OCR)   │  │ • chunker.py   │  │ • infoeproc_downloader.py  │ │
│  │ • DOCX         │  │ • uploader.py  │  │   (Download automático     │ │
│  │ • TXT/MD       │  │ • qa_extractor │  │    do TJSP)                │ │
│  │ • Excel        │  │                │  │                            │ │
│  └────────────────┘  └────────────────┘  └────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  main.py (CLI)                                                    │   │
│  │  • python main.py process <arquivo> --tipo --categoria            │   │
│  │  • python main.py list                                            │   │
│  │  • python main.py stats                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DEEPSEEK AI (API Externa)                      │
│  • Modelo: deepseek-chat                                                 │
│  • Gera respostas baseadas no contexto dos resultados                   │
│  • Chamado via RPC do Supabase (evita CORS)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes Principais

### 3.1 Frontend (React/TypeScript)

#### ConsultaContent.tsx
- Interface de chat estilo conversacional
- Avatares temáticos (Matrix)
- Sidebar com filtros de fontes
- Histórico de mensagens
- Sistema de feedback (👍/👎)

#### useConsultaSmith.ts (733 linhas)
Principal hook do sistema, responsável por:

1. **Preparação de Queries**
   - Mapa de sinônimos (e-proc, certidão, etc.)
   - Normalização de termos
   - Expansão semântica

2. **Busca Paralela**
   - Promise.all para consultas simultâneas
   - 3 fontes: Scripts, Oráculo, InfoEproc

3. **Normalização de Resultados**
   - Normalização de relevâncias (0-1)
   - Pesos por tipo de fonte
   - Limite dinâmico (5-7 resultados)

4. **Geração de Resposta**
   - Construção de prompt contextualizado
   - Chamada ao DeepSeek via RPC

### 3.2 Backend (Supabase/PostgreSQL)

#### Schema knowledge_base
- **documentos**: Metadados dos documentos processados
- **segmentos**: Chunks de texto com FTS
- **qa_pairs**: Pares pergunta/resposta

#### Schema oraculo
- **chamados**: Histórico de chamados resolvidos
- **search_vector_descricao**: FTS para descrições
- **search_vector_solucao**: FTS para soluções

#### Funções RPC
- `buscar_conhecimento()`: Busca híbrida FTS + Trigram
- `buscar_chamados()`: Busca em histórico
- `buscar_scripts_smith()`: Busca em scripts
- `chamar_deepseek()`: Proxy para IA

### 3.3 Smith Knowledge Processor (Python)

#### Extractors
- **PDFExtractor**: Extração de PDFs com OCR opcional
- **DOCXExtractor**: Documentos Word
- **TextExtractor**: Arquivos TXT
- **MarkdownExtractor**: Arquivos MD
- **ExcelExtractor**: Planilhas

#### Core
- **chunker.py**: Divisão inteligente com LangChain
- **uploader.py**: Upload para Supabase
- **qa_extractor.py**: Extração de Q&A

#### Robots
- **infoeproc_downloader.py**: Download automático de InfoEprocs do TJSP

---

## 4. Fluxo de Dados

### 4.1 Fluxo de Processamento de Documentos

```
┌─────────────────┐
│  Documento      │
│  (PDF/DOCX/...) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Extractor      │◄─── OCR para PDFs de InfoEproc
│  (Python)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Chunker        │◄─── LangChain RecursiveCharacterTextSplitter
│  (LangChain)    │     Chunk size: 1000, Overlap: 200
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Q&A Extractor  │◄─── Padrões: P:/R:, Pergunta:/Resposta:, Q:/A:
│  (Opcional)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Uploader       │──► Supabase (knowledge_base schema)
│  (Supabase)     │
└─────────────────┘
```

### 4.2 Fluxo de Consulta

```
┌─────────────────┐
│  Pergunta do    │
│  Usuário        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  prepararQuery  │◄─── Sinônimos + Normalização
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         BUSCAS PARALELAS                │
│  ┌───────────┐ ┌───────────┐ ┌────────┐│
│  │  Scripts  │ │  Oráculo  │ │InfoEpro││
│  │   RPC     │ │   RPC     │ │c  RPC  ││
│  └─────┬─────┘ └─────┬─────┘ └────┬───┘│
└────────┼─────────────┼────────────┼────┘
         │             │            │
         └──────┬──────┴─────┬──────┘
                │            │
                ▼            ▼
┌─────────────────────────────────────────┐
│  NORMALIZAÇÃO + RANKING                 │
│  • Normalizar relevâncias (0-1)         │
│  • Aplicar pesos (Oráculo 1.2x, etc.)   │
│  • Limite dinâmico (5-7 resultados)     │
│  • Diversificação inteligente           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  GERAÇÃO DE PROMPT                      │
│  • Contexto dos resultados              │
│  • Instrução de resposta                │
│  • Citação de fontes                    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  DEEPSEEK AI                            │
│  • Modelo: deepseek-chat                │
│  • Temperature: 0.7                     │
│  • Max tokens: 2000                     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  RESPOSTA + REFERÊNCIAS                 │
│  • Texto gerado pela IA                 │
│  • Cards com fontes citadas             │
│  • Sistema de feedback                  │
└─────────────────────────────────────────┘
```

---

## 5. Fontes de Conhecimento

### 5.1 Scripts de Atendimento

| Aspecto | Descrição |
|---------|-----------|
| **Conteúdo** | Procedimentos técnicos documentados |
| **Organização** | Grupos e Subpastas hierárquicos |
| **Indexação** | FTS com Trigram para fuzzy search |
| **Peso** | 1.1x (segunda prioridade) |

### 5.2 Oráculo (Chamados Resolvidos)

| Aspecto | Descrição |
|---------|-----------|
| **Conteúdo** | Histórico de chamados com soluções |
| **Campos** | Descrição + Solução indexadas |
| **Indexação** | FTS + Trigram por campo |
| **Peso** | 1.2x (máxima prioridade) |
| **Diferencial** | Soluções práticas validadas |

### 5.3 InfoEproc (Base de Conhecimento)

| Aspecto | Descrição |
|---------|-----------|
| **Conteúdo** | Documentos oficiais do TJSP sobre e-Proc |
| **Processamento** | PDF com OCR para imagens |
| **Indexação** | Segmentos (chunks) + Q&A pairs |
| **Peso** | 0.9x (complementar) |
| **Atualização** | Robô automático de download |

---

## 6. Pontos Fortes Identificados

### ✅ Arquitetura Bem Projetada

1. **Separação de Responsabilidades**
   - Frontend focado em UX
   - Backend focado em dados
   - Processador Python independente

2. **Busca Paralela**
   - Consultas simultâneas
   - Tempo de resposta otimizado

3. **FTS Nativo do PostgreSQL**
   - Sem dependência de embeddings
   - Stemming em português
   - Performance excelente

### ✅ Robustez do Sistema

1. **Fallbacks Implementados**
   - LangChain opcional
   - OCR opcional
   - Tratamento de erros

2. **Normalização de Resultados**
   - Pesos configuráveis
   - Limite dinâmico
   - Diversificação inteligente

3. **Sistema de Feedback**
   - Avaliações positivas/negativas
   - Métricas de uso

### ✅ Automação

1. **Robô de InfoEprocs**
   - Download automático
   - Processamento integrado
   - Tracking de versões

2. **CLI Completa**
   - Processamento em batch
   - Estatísticas
   - Gerenciamento

---

## 7. Limitações e Gargalos

### ⚠️ Limitações de Busca

1. **Sem Busca Semântica**
   - FTS depende de palavras exatas (após stemming)
   - Sinônimos são manuais e limitados
   - Não entende contexto/intenção

2. **Q&A Extractor Limitado**
   - Padrões fixos (P:/R:, etc.)
   - Não gera perguntas automaticamente
   - Poucos Q&A pairs sendo criados

3. **Chunking Genérico**
   - Mesmo tamanho para todos os tipos
   - Perde contexto de seções
   - Não preserva estrutura

### ⚠️ Gargalos de Performance

1. **OCR Lento**
   - 5-10 minutos por InfoEproc
   - Processamento sequencial
   - CPU intensivo

2. **Limite de Contexto**
   - 5-7 resultados máximo
   - DeepSeek tem limite de tokens
   - Informação pode ser perdida

### ⚠️ Limitações Estruturais

1. **Sinônimos Hardcoded**
   - Lista estática no código
   - Manutenção manual
   - Não aprende novos termos

2. **Sem Aprendizado Contínuo**
   - Feedback não melhora busca
   - Modelo não é retreinado
   - Conhecimento estático

3. **InfoEprocs Fragmentados**
   - Chunks sem hierarquia
   - Perda de contexto de seção
   - Referências quebradas

---

## 8. Conclusões

### Situação Atual

O sistema Smith é uma **implementação sólida** de busca híbrida usando FTS nativo do PostgreSQL. A arquitetura é bem organizada, com separação clara de responsabilidades e boas práticas de desenvolvimento.

### Principais Métricas

| Métrica | Valor Atual |
|---------|-------------|
| Tempo médio de resposta | ~2-5 segundos |
| Fontes de conhecimento | 3 (Scripts, Oráculo, InfoEproc) |
| Total de InfoEprocs | ~70+ documentos |
| Chunks por documento | ~100-300 |

### Oportunidades de Melhoria

1. **Curto Prazo**: Otimização de chunking e extração de Q&A
2. **Médio Prazo**: Implementação de busca semântica com embeddings
3. **Longo Prazo**: Sistema de aprendizado contínuo

**Próximo Documento:** [02_PROPOSTAS_MELHORIAS_INCREMENTAIS.md](02_PROPOSTAS_MELHORIAS_INCREMENTAIS.md)
