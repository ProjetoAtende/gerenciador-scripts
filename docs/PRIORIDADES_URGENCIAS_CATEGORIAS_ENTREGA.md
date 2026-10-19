# Prioridades e Urgências — Categoria da Anotação (entrega)

Implementação da solicitação *Categorias.md* (19/10/2026).

## O que foi implementado

### Banco de dados

| Item | Detalhe |
|------|---------|
| Migration | `20261019140000_prioridades_categoria_anotacao.sql` |
| `prioridades_anotacoes.categoria` | Oito valores: MLE, Sisbajud, Pesquisas, Cadastro, Expedição, Movimentação, Publicação, Audiências |
| `prioridades_usuarios_perfil.categorias_habilitadas` | Lista por analista; `NULL` = todas (padrão após backfill) |
| Backfill | Anotações existentes → categoria **MLE** + trecho na descrição |
| `prioridades_criar_anotacao` | Categoria **obrigatória** na criação |
| `prioridades_conferir` | Gestor/Conferente pode **alterar** categoria |
| `prioridades_pode_ver` | **Coordenador**: todas as categorias da UPJ; **Analista**: só categorias habilitadas |
| `prioridades_proximo_da_fila` | Rodízio UPJ considera categoria ao vincular analista |
| RPCs auxiliares | `prioridades_atualizar_categorias_habilitadas`, `prioridades_listar_categorias_analistas` |
| `prioridades_meu_perfil` | Retorna `categorias_habilitadas` |

### Front-end

| Tela / área | Comportamento |
|-------------|----------------|
| Nova Anotação | `CategoriaAnotacaoField` — 8 rádios (2×4), ℹ️ com tooltip, **após** Solicitante e **antes** de Tipo de Prioridade |
| Listas / cards | `CategoriaBadge` ao lado do status |
| Painel UPJ | `FiltroCategoriaUpj` para Coordenador e Analista |
| Designações → Analistas | Coluna **Categorias habilitadas** (8 checkboxes); **Vinculação automática oculta** (não removida no backend) |
| Designações → Conferentes | **Vinculação automática** mantida |
| Conferência | Edição de categoria |

### Guia de uso atualizado

[COMO_USAR_PRIORIDADES_URGENCIAS.md](COMO_USAR_PRIORIDADES_URGENCIAS.md) — casos 2, 3, 4, 6 e matriz CAT-01…CAT-06.

## Testes Grokbot (19/10/2026, DEV localhost:5174)

**Veredito: APROVADO**

| Escopo | Resultado |
|--------|-----------|
| **C1–C9** | Todos **OK** |
| **R1–R3** | Regressão **OK** |
| **C4 / C6** | Analista A (MLE + Sisbajud) e B (só Cadastro), mesma UPJ: A não vê Cadastro, B vê; Coordenador vê tudo |
| **Filtro** | Presente só no perfil UPJ |
| **Designações** | Vinculação automática oculta para analistas; mantida para conferentes |
| **Conferência** | Alteração de categoria OK |
| **Legado** | Backfill MLE OK |
| **Admin** | Na 1ª tentativa do C6, admin criador enxergava tudo (esperado por `prioridades_pode_ver`); reteste com usuário não-admin passou |

**Dados de teste:** anotações `[TESTE] CAT*` ids 116–121 em `upj-rejeitada` (nenhuma aberta). Sem bugs de produto reportados.

Roteiro completo: [PRIORIDADES_URGENCIAS_CATEGORIAS_TESTES.md](PRIORIDADES_URGENCIAS_CATEGORIAS_TESTES.md).
