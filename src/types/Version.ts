// src/types/Version.ts

/**
 * Tipos para o sistema de versionamento e changelog
 */

export interface VersionFeature {
  /** Descrição curta da feature */
  title: string;
  /** Descrição detalhada (opcional) */
  description?: string;
  /** Tipo da mudança */
  type: 'feature' | 'improvement' | 'fix' | 'breaking';
  /** Área do sistema afetada */
  area?: string;
}

export interface Version {
  /** Número da versão (semver: major.minor.patch) */
  version: string;
  /** Data de lançamento */
  date: string;
  /** Título/nome da versão (opcional) */
  title?: string;
  /** Lista de features/mudanças */
  features: VersionFeature[];
  /** Indica se é a versão atual */
  isCurrent?: boolean;
}

export interface UserVersionView {
  id: string;
  user_id: string;
  version: string;
  viewed_at: string;
}

/**
 * Changelog completo do sistema
 * Ordem: da mais recente para a mais antiga
 */
export const CHANGELOG: Version[] = [
  {
    version: '12.3',
    date: '2026-09-28',
    title: 'Identidade visual da Home',
    isCurrent: true,
    features: [
      {
        title: 'Cabeçalho institucional TJSP',
        description:
          'A Home passou a exibir o header institucional (brasão, título, slogan, logos eproc e TJSP Atende), alinhado ao layout do projeto NAPE.',
        type: 'improvement',
        area: 'Home',
      },
      {
        title: 'Simulação de visualização desativada',
        description:
          'A barra de simulação de setor/equipe/papel foi preservada no código, porém desligada via HOME_VISUALIZACAO_SIMULACAO_ENABLED.',
        type: 'improvement',
        area: 'Home',
      },
      {
        title: 'Rodapé e badge de versão enxutos',
        description:
          'Footer reduzido a ShadowFlow Technologies 2026; badge de versão oculto (VERSION_BADGE_ENABLED) mantendo o changelog no código.',
        type: 'improvement',
        area: 'Home',
      },
    ],
  },
  {
    version: '12.2',
    date: '2026-09-23',
    title: 'Exclusão de scripts na curadoria',
    isCurrent: false,
    features: [
      {
        title: 'Aprovação de exclusão no modal Scripts',
        description: 'Filtro Revisão → Exclusão lista solicitações pendentes; a curadoria aprova ou nega pela lixeira do card. A aba Exclusões Scripts saiu do BossOnly.',
        type: 'improvement',
        area: 'Scripts',
      },
      {
        title: 'Notificações de exclusão para Curadoria de Scripts',
        description: 'O sininho e as RPCs passam a usar a permissão scripts.curadoria_acesso (equipe/perfil/usuário), em vez de notificar apenas administradores.',
        type: 'improvement',
        area: 'Notificações',
      },
    ],
  },
  {
    version: '12.1',
    date: '2026-09-22',
    title: 'Histórico de Sistemas',
    isCurrent: false,
    features: [
      {
        title: 'Histórico de Sistemas na Home',
        description: 'Novo card com catálogo de sistemas, histórico de implantação em tela cheia, exportação Excel formatada e CRUD de sistemas e entradas (autorização inicial NAPE via Boss)',
        type: 'feature',
        area: 'Home',
      },
    ],
  },
  {
    version: '12.0',
    date: '2026-08-14',
    title: 'Escalas, SMAX remoto e novas operações do sistema',
    features: [
      {
        title: 'Escala compartilhada com rotinas semanais',
        description: 'A escala ganhou calendário compartilhado, rotinas semanais, exceções por dia, resumos mais claros e melhorias de edição institucional para facilitar o planejamento da equipe',
        type: 'feature',
        area: 'Escala'
      },
      {
        title: 'Execução remota dos robôs SMAX',
        description: 'Foram adicionados monitoramento, heartbeat, logs e controles de permissão para operação remota dos robôs SMAX com mais segurança e visibilidade',
        type: 'feature',
        area: 'SMAX'
      },
      {
        title: 'Fluxo de ownership de tarefas por equipe',
        description: 'Agora as tarefas podem ser atribuídas e acompanhadas com ownership por equipe, melhorando a responsabilização e o acompanhamento operacional',
        type: 'feature',
        area: 'Tarefas'
      },
      {
        title: 'Links com classificação, data e filtros melhores',
        description: 'Os links do sistema passaram a exibir data de criação, classificação por tipo e filtros mais precisos para navegação e auditoria',
        type: 'improvement',
        area: 'Links'
      },
      {
        title: 'Permissões centralizadas na Home',
        description: 'A tela inicial passou a centralizar regras de acesso e a oferecer simulação de visualização administrativa, deixando o controle mais consistente',
        type: 'improvement',
        area: 'Permissões'
      },
      {
        title: 'Radar e Oráculo com mais estabilidade',
        description: 'Foram refinados fluxos do Radar e da Análise Oráculo, incluindo correções de timeout, reativação, ajuda contextual e consultas legadas',
        type: 'fix',
        area: 'Oráculo'
      },
      {
        title: 'Notificações arquivadas ordenadas por data recente',
        description: 'A visualização de notificações arquivadas agora prioriza os registros mais recentes, facilitando a revisão do histórico',
        type: 'improvement',
        area: 'Notificações'
      },
      {
        title: 'Aprimoramentos gerais em homologação e prioridades',
        description: 'Tickets de homologação ganharam regras de prioridade, novos ajustes de visualização e suporte ampliado em fluxos operacionais do sistema',
        type: 'improvement',
        area: 'Operação'
      }
    ]
  },
  {
    version: '11.2',
    date: '2026-02-16',
    title: 'Dashboard de Categorias — Gráficos Avançados',
    isCurrent: false,
    features: [
      {
        title: 'Gráfico Sunburst (Hierarquia de Categorias)',
        description: 'Novo gráfico interativo em formato de anel que mostra categorias e suas subcategorias simultaneamente. Clique em uma fatia para expandir e ver detalhes. Clique no centro para voltar à visão geral',
        type: 'feature',
        area: 'Dashboard'
      },
      {
        title: 'Subcategorias ao Clicar na Barra',
        description: 'No gráfico de Distribuição por Categoria, clique em qualquer barra para ver um modal com as subcategorias daquela categoria, incluindo quantidade e percentual de cada uma',
        type: 'feature',
        area: 'Dashboard'
      },
      {
        title: 'Seletor de Período em Todos os Gráficos',
        description: 'Todos os gráficos do Dashboard agora possuem seletor de período: 24 horas, 48 horas, 72 horas e 7 dias. O período padrão é 24 horas',
        type: 'feature',
        area: 'Dashboard'
      },
      {
        title: 'Linha do Tempo por Subcategoria',
        description: 'Na aba Linha do Tempo, selecione uma categoria específica para ver a evolução temporal de suas subcategorias individualmente',
        type: 'feature',
        area: 'Dashboard'
      },
      {
        title: 'Visual Escuro Unificado',
        description: 'O gráfico de barras da Distribuição foi reformulado em modo escuro, harmonizando com o restante do Dashboard',
        type: 'improvement',
        area: 'Dashboard'
      },
      {
        title: 'Contagens Consistentes entre Gráficos',
        description: 'Correção que garante que todos os gráficos mostrem exatamente os mesmos totais quando selecionado o mesmo período. Anteriormente podiam haver pequenas diferenças',
        type: 'fix',
        area: 'Dashboard'
      }
    ]
  },
  {
    version: '11.1',
    date: '2026-02-16',
    title: 'Comentários com Autoria e Resposta IA Editável',
    isCurrent: false,
    features: [
      {
        title: 'Sistema de Comentários com Autoria',
        description: 'Cada ticket favorito agora suporta múltiplos comentários organizados em thread. Cada comentário exibe nome do autor e data. Apenas o autor pode editar ou excluir seus comentários. Base de conhecimento colaborativa com rastreabilidade completa',
        type: 'feature',
        area: 'Favoritos'
      },
      {
        title: 'Editor Rico para Comentários',
        description: 'Comentários usam o Editor Rico (RichTextEditor) com formatação, imagens e vídeos. Permite criar anotações estruturadas e ricas para documentar soluções',
        type: 'feature',
        area: 'Favoritos'
      },
      {
        title: 'Resposta IA Editável nos Favoritos',
        description: 'A resposta gerada pela IA pode ser editada e refinada diretamente nos Favoritos. Sistema rastreia quem fez a última edição e quando. A versão original permanece preservada no SMAX e nos Chamados Registrados',
        type: 'feature',
        area: 'Favoritos'
      },
      {
        title: 'Badge de Edição na Resposta IA',
        description: 'Quando a Resposta IA é editada, um badge visual informa "A resposta original foi editada" e exibe "Última edição por [Nome] em [Data]". Transparência total sobre modificações',
        type: 'improvement',
        area: 'Favoritos'
      },
      {
        title: 'Compatibilidade com Sistema Legado',
        description: 'Trigger automático sincroniza tickets.comentario com o último comentário da thread para manter compatibilidade com ComentarioModal e outros componentes legados',
        type: 'improvement',
        area: 'Backend'
      }
    ]
  },
  {
    version: '11',
    date: '2026-02-17',
    title: 'Favoritos, Editor Rico e Melhorias de Interface',
    features: [
      {
        title: 'Sistema de Favoritos Completo',
        description: 'Marque tickets importantes com ⭐ para acesso rápido. Disponível no Distribuidor, Chamados Registrados e Dashboard. Inclui modal fullscreen com filtros por número, GSE, categoria, subcategoria e busca textual',
        type: 'feature',
        area: 'Favoritos'
      },
      {
        title: 'Filtros de Categoria e Subcategoria',
        description: 'Filtre favoritos por categoria e subcategoria do Oráculo. Filtro cascata: subcategoria depende da categoria selecionada. Contadores dinâmicos por filtro',
        type: 'feature',
        area: 'Favoritos'
      },
      {
        title: 'Editor Rico nos Editores de Resposta',
        description: 'SalvarRespostaModal (Distribuidor) e ChamadoDetailsModal (Chamados Registrados) agora usam o Editor Rico com barra de ferramentas completa, substituindo o textarea simples',
        type: 'improvement',
        area: 'Distribuidor'
      },
      {
        title: 'Colar Imagens da Área de Transferência',
        description: 'Cole imagens diretamente no editor com Ctrl+V. As imagens são enviadas automaticamente ao servidor e inseridas no texto. Funciona em todos os editores ricos do sistema',
        type: 'feature',
        area: 'Editor'
      },
      {
        title: 'Link Direto para o SMAX',
        description: 'Números de chamado nos cards e detalhes dos Favoritos são clicáveis e abrem diretamente no sistema SMAX em nova aba',
        type: 'feature',
        area: 'Favoritos'
      },
      {
        title: 'Atendente com Nome Legível',
        description: 'O campo "Atendente Atual" nos Favoritos agora exibe o nome do técnico em vez do UUID interno',
        type: 'fix',
        area: 'Favoritos'
      },
      {
        title: 'Modal de Ajuda dos Favoritos',
        description: 'Novo botão de ajuda (?) no header dos Favoritos com guia completo: como favoritar, filtros, categorias, editor rico, atalhos e dicas avançadas',
        type: 'feature',
        area: 'Favoritos'
      },
      {
        title: '46 Testes Automatizados',
        description: 'Infraestrutura de testes com Vitest configurada. 46 testes unitários e de componentes cobrindo favoritosService, useFavoritos e FavoritoBotao',
        type: 'improvement',
        area: 'Testes'
      }
    ]
  },
  {
    version: '10.4',
    date: '2026-02-16',
    title: 'Sistema de Subcategorias',
    isCurrent: false,
    features: [
      {
        title: 'Subcategorias para Chamados',
        description: 'Chamados agora podem ser classificados em subcategorias mais específicas dentro de cada categoria principal. Isso permite uma organização mais detalhada e análises mais precisas',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Filtro Dependente de Subcategorias',
        description: 'Novo filtro no Distribuidor que se adapta dinamicamente à categoria selecionada, mostrando apenas as subcategorias disponíveis. Filtros podem ser usados em conjunto ou separadamente',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Classificação Automática Inteligente',
        description: 'Sistema Oráculo agora classifica automaticamente tanto a categoria quanto a subcategoria de chamados usando IA, com duas chamadas sequenciais para maior precisão',
        type: 'feature',
        area: 'Oráculo'
      },
      {
        title: 'Coluna de Subcategoria na Tabela',
        description: 'Nova coluna visual na tabela do Distribuidor mostrando a subcategoria com ícone e cores, facilitando a identificação rápida do tipo específico de cada chamado',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Pipeline de Descoberta de Subcategorias',
        description: 'Sistema automatizado com 4 scripts integrados para descobrir, categorizar e aplicar subcategorias em grandes volumes de dados históricos usando IA',
        type: 'feature',
        area: 'Scripts'
      }
    ]
  },
  {
    version: '10.3',
    date: '2026-02-15',
    title: 'Melhorias nas Estatísticas e Visualizações',
    isCurrent: false,
    features: [
      {
        title: 'Paginação Automática em Estatísticas',
        description: 'Correção do limite de carregamento de dados. Estatísticas agora carregam todos os tickets do período selecionado, sem limitação de 2000 registros',
        type: 'fix',
        area: 'Estatísticas'
      },
      {
        title: 'Nova Visualização de Evolução Comparativa',
        description: 'Gráfico de evolução comparativa reformulado para melhor aproveitamento de espaço. Exibição inicial otimizada com Top 5 membros',
        type: 'improvement',
        area: 'Estatísticas'
      },
      {
        title: 'Seletor de Membros no Gráfico',
        description: 'Controle personalizado de quais membros são exibidos no gráfico de evolução. Escolha quantas linhas exibir e selecione membros específicos',
        type: 'feature',
        area: 'Estatísticas'
      },
      {
        title: 'Redistribuição de Layout',
        description: 'Ranking de membros e detalhes agora dividem espaço horizontal para melhor visualização simultânea',
        type: 'improvement',
        area: 'Estatísticas'
      }
    ]
  },
  {
    version: '10.2',
    date: '2026-02-13',
    title: 'Otimização de Performance - Scripts (Fase 1)',
    isCurrent: false,
    features: [
      {
        title: 'Carregamento 90% Mais Rápido',
        description: 'Sistema de Scripts otimizado para carregar apenas dados essenciais. Payload reduzido de ~5-12 MB para ~300 KB. Tempo de carregamento estimado de 10+ segundos para 1-2 segundos',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Lazy Loading de Conteúdo',
        description: 'Conteúdo completo dos scripts agora é carregado sob demanda apenas ao abrir o editor ou gerador. Listagem não carrega mais HTML/texto de 600+ scripts',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Queries Consolidadas',
        description: 'Eliminação de queries redundantes na tabela users. De 3 queries separadas para 1 unificada. JOIN desnecessário com pastas_scripts removido',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Seleção Específica de Colunas',
        description: 'Query principal agora seleciona apenas 26 colunas necessárias para listagem, eliminando campos grandes (conteudo_bruto, conteudo_original) que não são exibidos',
        type: 'improvement',
        area: 'Scripts'
      }
    ]
  },
  {
    version: '10.1',
    date: '2026-02-13',
    title: 'Melhorias no Editor de Scripts',
    isCurrent: false,
    features: [
      {
        title: 'Layout Horizontal do Editor',
        description: 'Header do editor de scripts completamente redesenhado com layout compacto em 2 linhas horizontais. Todos os metadados agora são exibidos de forma organizada e profissional, separados por | verticais',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Campo Tipo do Requisitante Obrigatório',
        description: 'Novo campo obrigatório com 77 perfis do eProc disponíveis. Modal com busca e autocomplete para seleção rápida. Scripts não podem ser salvos sem preencher este campo',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Número do Script Visível',
        description: 'O número de referência do script (#556, #557, etc.) agora aparece no header do editor ao lado do título, facilitando identificação durante edição',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Consolidação de Pastas Desativados',
        description: 'Correção de bug que duplicava a pasta "🗑️ Desativados". Agora todos os scripts desativados aparecem em uma única pasta unificada',
        type: 'fix',
        area: 'Scripts'
      }
    ]
  },
  {
    version: '1.10.0',
    date: '2026-02-12',
    title: 'Seleção em Lote de Tickets para Globais',
    isCurrent: false,
    features: [
      {
        title: 'Anexação em Lote ao Global',
        description: 'Selecione múltiplos tickets com Ctrl+Click no ícone de Link e anexe todos de uma vez ao mesmo Chamado Global. Modal de confirmação mostra prévia dos tickets selecionados',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Números Clicáveis para Copiar',
        description: 'Todos os números de tickets e globais agora são clicáveis. Clique para copiar automaticamente com feedback visual de "Copiado!" por 2 segundos',
        type: 'feature',
        area: 'Interface'
      },
      {
        title: 'Auto-Suspensão ao Anexar',
        description: 'Tickets anexados a Globais são automaticamente suspensos com causa "Anexado ao Global [NÚMERO]". Evita processamento enquanto aguardam solução global',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Progresso em Tempo Real',
        description: 'Barra de progresso mostra anexação de cada ticket em lote, com relatório final de sucessos e falhas',
        type: 'improvement',
        area: 'Distribuidor'
      },
      {
        title: 'Botão Flutuante de Seleção',
        description: 'Aparece ao selecionar tickets, mostrando quantidade selecionada e opções "Anexar ao Global" ou "Limpar". Atalho Esc também limpa seleção',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Indicadores Visuais de Seleção',
        description: 'Tickets selecionados ficam com borda verde e checkbox marcado. Visual claro para confirmação antes de anexar',
        type: 'improvement',
        area: 'Interface'
      },
      {
        title: 'Documentação Completa no Helper Modal',
        description: 'Modal de ajuda dos Chamados Globais atualizado com seção detalhada sobre seleção em lote, atalhos e fluxos',
        type: 'improvement',
        area: 'Ajuda'
      }
    ]
  },
  {
    version: '1.9.0',
    date: '2026-02-11',
    title: 'Scripts Temporários e Validação de Autoria',
    isCurrent: false,
    features: [
      {
        title: 'Scripts Temporários',
        description: 'Marque scripts como "Temporários" quando forem soluções de contorno para implantação do e-Proc. Eles aparecem com cor laranja e podem ser filtrados separadamente. Ideal para documentar workarounds que serão removidos futuramente',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Filtro de Tipo de Script',
        description: 'Novo filtro permite visualizar: Todos os scripts, apenas Temporários ou apenas Permanentes. O contador mostra quantos scripts temporários existem',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Validação Obrigatória de Autor',
        description: 'Ao criar um novo script, é obrigatório selecionar o autor. Isso garante rastreabilidade e facilita identificar quem criou cada script',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Busca Aprimorada',
        description: 'Campo de busca agora indica claramente "Buscar títulos..." para melhor compreensão',
        type: 'improvement',
        area: 'Scripts'
      }
    ]
  },
  {
    version: '1.8.0',
    date: '2026-02-11',
    title: 'Chamados Globais e Auto Oráculo Aprimorado',
    isCurrent: false,
    features: [
      {
        title: 'Sistema de Chamados Globais',
        description: 'Agrupe múltiplos tickets relacionados ao mesmo problema em um único Chamado Global. Responda todos de uma vez com distribuição automática e igualitária entre a equipe',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Modal de Ajuda - Chamados Globais',
        description: 'Guia completo e detalhado sobre como usar o sistema de Chamados Globais, incluindo: criação, anexação de tickets, distribuição igualitária, estados e boas práticas',
        type: 'feature',
        area: 'Ajuda'
      },
      {
        title: 'Auto Oráculo Sem Limites',
        description: 'Sistema de análise automática agora carrega TODOS os tickets da fila para encontrar os que precisam de análise, não mais limitado aos 100 mais recentes',
        type: 'improvement',
        area: 'Oráculo'
      },
      {
        title: 'Botão Categorizar',
        description: 'Novo botão ao lado de "Globais" permite disparar o Auto Oráculo manualmente a qualquer momento, sem esperar os 30 minutos do ciclo automático',
        type: 'feature',
        area: 'Oráculo'
      },
      {
        title: 'Anexar Tickets ao Global',
        description: 'Clique no ícone de link ao lado de qualquer ticket para anexá-lo a um Chamado Global. O ticket é automaticamente mantido e marcado com badge roxo',
        type: 'feature',
        area: 'Distribuidor'
      },
      {
        title: 'Distribuição Round-Robin',
        description: 'Ao responder um Chamado Global, os tickets são distribuídos automaticamente de forma balanceada entre todos os membros da equipe (variação máxima de 1 ticket)',
        type: 'feature',
        area: 'Distribuidor'
      }
    ]
  },
  {
    version: '1.7.1',
    date: '2026-02-09',
    title: 'Documentos e Priorização Manual de Tarefas',
    isCurrent: false,
    features: [
      {
        title: 'Anexar Documentos e Links em Tarefas',
        description: 'Adicione links do TJSP e outros documentos importantes diretamente nas tarefas. Todos da equipe podem visualizar e acessar',
        type: 'feature',
        area: 'Tarefas'
      },
      {
        title: 'Ordenação Manual por Gravidade',
        description: 'Arraste e solte tarefas na sua coluna para organizá-las por prioridade. A ordenação personalizada é salva automaticamente',
        type: 'feature',
        area: 'Tarefas'
      },
      {
        title: 'Edição de Documentos',
        description: 'Links já publicados podem ser editados ou removidos pelo dono da tarefa',
        type: 'improvement',
        area: 'Tarefas'
      }
    ]
  },
  {
    version: '1.7.0',
    date: '2026-02-08',
    title: 'Sistema de Tarefas e Análise de Capacidade Avançada',
    isCurrent: false,
    features: [
      {
        title: 'Sistema Completo de Tarefas',
        description: 'Novo sistema de gerenciamento de tarefas com estados, fases, threads de discussão, menções e notificações automáticas',
        type: 'feature',
        area: 'Tarefas'
      },
      {
        title: 'Atualização em Tempo Real',
        description: 'Histórico de tarefas e discussões atualizam automaticamente quando outros usuários fazem alterações',
        type: 'improvement',
        area: 'Tarefas'
      },
      {
        title: 'Análise de Capacidade - Período de 168h (7 dias)',
        description: 'Agora é possível visualizar métricas de até 7 dias completos (168 horas), ideal para análises semanais com destaque nas viradas de dia',
        type: 'feature',
        area: 'Estatísticas'
      },
      {
        title: 'Análise de Capacidade - Médias por Dias Úteis',
        description: 'Todas as médias diárias agora são calculadas sobre 5 dias úteis (não mais 7), refletindo a realidade de que entrada nos finais de semana é menos de 10% de um dia útil',
        type: 'improvement',
        area: 'Estatísticas'
      },
      {
        title: 'Análise de Capacidade - Fila Simulada no Modo Comercial',
        description: 'Quando ativado o modo "Apenas Horário Comercial", a fila acumulada mostra a situação SIMULADA caso respostas fora do horário comercial não tivessem acontecido',
        type: 'feature',
        area: 'Estatísticas'
      },
      {
        title: 'Análise de Capacidade - Visualização por Totais Diários',
        description: 'Novo modo de visualização que agrupa valores por dia completo, facilitando comparações diárias. Toggle entre "Evolução hora a hora" e "Valores Totais"',
        type: 'feature',
        area: 'Estatísticas'
      },
      {
        title: 'Análise de Capacidade - Prognóstico Contextual',
        description: 'Cálculo de déficit agora considera DOIS fatores: gap de capacidade (diferença entre entrada e resposta médias) + acúmulo do período. Mostra quantos chamados/hora a mais são necessários para resolver o problema',
        type: 'improvement',
        area: 'Estatísticas'
      },
      {
        title: 'Correções de Datas no Gráfico',
        description: 'Labels dos dias da semana agora aparecem corretamente sem deslocamento de 1 dia',
        type: 'fix',
        area: 'Estatísticas'
      },
      {
        title: 'Sistema de Confirmação Melhorado',
        description: 'Novo modal de confirmação com cores e ícones para diferentes tipos de ações (informação, aviso, perigo, sucesso)',
        type: 'improvement',
        area: 'Interface'
      },
      {
        title: 'Performance Melhorada',
        description: 'Sistema de tarefas otimizado com até 70% de ganho de velocidade em listagens grandes',
        type: 'improvement',
        area: 'Sistema'
      }
    ]
  },
  {
    version: '1.6.1',
    date: '2026-02-06',
    title: 'Visualizações de Atividade de Respondentes',
    isCurrent: false,
    features: [
      {
        title: 'Top 10 Respondentes do Período',
        description: 'Nova visualização mostrando os usuários que mais responderam tickets no período selecionado, com filtros por período (1-90 dias) e grupo designado',
        type: 'feature',
        area: 'Oráculo - Estatísticas'
      },
      {
        title: 'Produtividade Média por Período',
        description: 'Gráfico de linha mostrando a produtividade média (respostas por pessoa) ao longo do tempo, agregado por dia/semana/mês conforme período. Tooltip detalhado mostra cálculo e intervalo de datas',
        type: 'feature',
        area: 'Oráculo - Estatísticas'
      },
      {
        title: 'Abertos vs Atendidos',
        description: 'Comparação visual entre tickets abertos e tickets atendidos (Fechado + Ag. Aceite Definitivo) ao longo do tempo, com indicador de saldo',
        type: 'feature',
        area: 'Oráculo - Estatísticas'
      },
      {
        title: 'Busca Textual Urgente no Distribuidor',
        description: 'Novo campo de busca na aba "Livres" do Distribuidor de Chamados. Permite encontrar rapidamente tickets urgentes com palavras-chave como "agravo", "prazo", "liminar". Resultados ordenados por VIP + tempo de espera',
        type: 'feature',
        area: 'Distribuidor de Chamados'
      }
    ]
  },
  {
    version: '1.6.0',
    date: '2026-02-06',
    title: 'Análise de Capacidade e Melhorias em Estatísticas',
    isCurrent: false,
    features: [
      {
        title: 'Análise de Capacidade de Resposta',
        description: 'Nova aba Métricas com análise completa: entrada vs respondidos 24h, médias de 7 dias, saldo diário, tendências e prognóstico de capacidade',
        type: 'feature',
        area: 'Estatísticas'
      },
      {
        title: 'Análise da Fila Real Acumulada',
        description: 'Projeção de zeramento da fila baseada no ritmo atual, capacidade necessária para zerar em 7/14/30 dias, e status da tendência (reduzindo/crescendo/estagnada)',
        type: 'feature',
        area: 'Estatísticas'
      },
      {
        title: 'Gráfico Entrada vs Resposta por Hora',
        description: 'Visualização hora a hora das últimas 24h mostrando quando a equipe está reduzindo ou acumulando fila',
        type: 'feature',
        area: 'Estatísticas'
      },
      {
        title: 'Correção de discrepância nas métricas',
        description: 'Todas as métricas agora filtram corretamente por GSEs da equipe. Estatísticas GSE e Métricas mostram valores consistentes',
        type: 'fix',
        area: 'Estatísticas'
      },
      {
        title: 'Correção de timezone nos gráficos',
        description: 'Gráficos de estatísticas agora exibem horário local correto (São Paulo UTC-3) ao invés de UTC',
        type: 'fix',
        area: 'Estatísticas'
      },
      {
        title: 'GSE padrão 24h',
        description: 'Estatísticas de GSE agora abrem com período de 24h por padrão ao invés de 30 dias',
        type: 'improvement',
        area: 'Estatísticas'
      },
      {
        title: 'Membros padrão "Todos"',
        description: 'Estatísticas dos Membros agora abre com "Todos" selecionado por padrão ao invés de um membro específico',
        type: 'fix',
        area: 'Estatísticas'
      },
      {
        title: 'Remoção do overlay de desenvolvimento',
        description: 'Modal de Estatísticas abre diretamente sem aviso de "Ainda em Desenvolvimento"',
        type: 'improvement',
        area: 'Interface'
      }
    ]
  },
  {
    version: '1.5.3',
    date: '2026-02-06',
    title: 'Expansão do Sistema Oráculo com Novas Colunas',
    isCurrent: false,
    features: [
      {
        title: 'Upload Excel expandido com 10 colunas',
        description: 'Sistema Oráculo agora processa 10 colunas de dados: datas de abertura e aceite, ID, grupo, descrição, solução, email, CPF e informações do designado',
        type: 'feature',
        area: 'Oráculo'
      },
      {
        title: 'Correção de erros em uploads',
        description: 'Sistema de limpeza de texto melhorado para processar arquivos com caracteres especiais',
        type: 'fix',
        area: 'Oráculo'
      },
      {
        title: 'Otimização para arquivos grandes',
        description: 'Melhor processamento de uploads com mais de 7 mil registros',
        type: 'improvement',
        area: 'Oráculo'
      },
      {
        title: 'Edição de pergunta e número de chamado no editor',
        description: 'Agora é possível editar a pergunta e número de chamado diretamente no editor fullscreen de scripts. O modal de visualização permite adicionar ou modificar essas informações sem sair do editor',
        type: 'feature',
        area: 'Editor de Scripts'
      },
      {
        title: 'Auto-inscrição em chats ao participar',
        description: 'Qualquer pessoa que escrever em um chat é automaticamente inscrita para receber notificações de novas mensagens. Não é mais necessário ser mencionado para acompanhar uma conversa que você iniciou ou na qual já participou',
        type: 'improvement',
        area: 'Chat'
      }
    ]
  },
  {
    version: '1.5.2',
    date: '2026-02-03',
    title: 'Editor de Scripts com Detecção Inteligente de Formatação',
    isCurrent: false,
    features: [
      {
        title: 'Detecção automática de fonte e tamanho',
        description: 'Os dropdowns de Fonte e Tamanho atualizam automaticamente ao clicar no texto, mostrando a formatação atual. Agora com 36 fontes incluindo Inter, Calibri e todas as principais do Word',
        type: 'feature',
        area: 'Editor de Scripts'
      },
      {
        title: 'Indicadores visuais de formatação ativa',
        description: 'Botões de Negrito, Itálico, Sublinhado e Riscado ficam destacados em azul quando ativos no texto selecionado',
        type: 'improvement',
        area: 'Editor de Scripts'
      },
      {
        title: 'Detecção de parágrafo e títulos',
        description: 'O dropdown de estilos (Parágrafo, Título 1-3) mostra automaticamente o formato do texto onde o cursor está',
        type: 'feature',
        area: 'Editor de Scripts'
      },
      {
        title: 'Detecção de alinhamento',
        description: 'Botões de alinhamento (esquerda, centro, direita) ficam destacados conforme o alinhamento do texto atual',
        type: 'feature',
        area: 'Editor de Scripts'
      },
      {
        title: 'Detecção de listas',
        description: 'Botões de lista com marcadores e numerada ficam destacados quando o cursor está em uma lista',
        type: 'feature',
        area: 'Editor de Scripts'
      },
      {
        title: 'Notificações automáticas em conversas',
        description: 'Após ser mencionado (@usuario ou @equipe) em um chat, você recebe notificações automáticas de todas as mensagens seguintes, sem necessidade de nova menção',
        type: 'improvement',
        area: 'Chat'
      }
    ]
  },
  {
    version: '1.5.1',
    date: '2026-02-03',
    title: 'Ajustes no Gerador de Scripts e Melhorias no Editor',
    isCurrent: false,
    features: [
      {
        title: 'Inserção de texto mais estável ao copiar scripts',
        description: 'Melhorias no sistema de inserções de texto para manter o fluxo correto no texto copiado',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Bloqueio de cópia com campos livres vazios',
        description: 'Quando houver () não preenchido, o sistema alerta e impede a cópia até o preenchimento',
        type: 'fix',
        area: 'Scripts'
      },
      {
        title: 'Destaque visual de campos obrigatórios',
        description: 'Campos de inserção livre vazios ficam destacados em vermelho para fácil identificação',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Formatação de IA preserva saudações e variáveis',
        description: 'O "Formatar Texto" mantém "Prezado usuário" e estruturas como {[Prezado][Prezada]} e ()',
        type: 'fix',
        area: 'IA'
      },
      {
        title: 'Sistema de inserção de vídeos aprimorado',
        description: 'Interface melhorada com modais intuitivos para upload ou URL. Vídeos são sempre inseridos como links clicáveis devido a limitações do SMAX',
        type: 'improvement',
        area: 'Editor de Scripts'
      }
    ]
  },
  {
    version: '1.5.0',
    date: '2026-01-29',
    title: 'Sistema de Scripts Aprimorado',
    isCurrent: false,
    features: [
      {
        title: 'Referência numérica nos scripts',
        description: 'Cada script agora possui um número de referência (#1, #2, etc.) para facilitar a identificação',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Busca por número de referência',
        description: 'Campo de busca para encontrar scripts pelo número de referência',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Identificação do autor',
        description: 'Ícone mostrando quem criou cada script com tooltip informativo',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Busca por autor',
        description: 'Campo de busca com autocomplete para filtrar scripts por autor',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Campo de autor no editor',
        description: 'Novo campo com autocomplete para definir ou alterar o autor do script',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Filtro por equipe (Não Curados)',
        description: 'Filtro de equipe disponível ao visualizar scripts não curados',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Contador dinâmico',
        description: 'Contador de "Não Curados" mostra quantidade filtrada/total quando filtro de equipe está ativo',
        type: 'improvement',
        area: 'Scripts'
      },
      {
        title: 'Sistema de Changelog',
        description: 'Nova funcionalidade para visualizar novidades e histórico de versões do sistema',
        type: 'feature',
        area: 'Sistema'
      }
    ]
  },
  {
    version: '1.4.0',
    date: '2026-01-20',
    title: 'Melhorias de Curadoria',
    features: [
      {
        title: 'Sistema de curadoria de scripts',
        description: 'Marcar scripts como curados/não curados para controle de qualidade',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Filtro de scripts não curados',
        description: 'Visualização dedicada para scripts que precisam de revisão',
        type: 'feature',
        area: 'Scripts'
      },
      {
        title: 'Upload de arquivos Excel',
        description: 'Importar scripts em massa via arquivo Excel',
        type: 'feature',
        area: 'Scripts'
      }
    ]
  },
  {
    version: '1.3.0',
    date: '2026-01-10',
    title: 'Notificações e Menções',
    features: [
      {
        title: 'Sistema de notificações',
        description: 'Receba alertas sobre menções e atividades nos chamados',
        type: 'feature',
        area: 'Notificações'
      },
      {
        title: 'Menções de usuário (@nome)',
        description: 'Mencione colegas nos comentários dos chamados',
        type: 'feature',
        area: 'Chamados'
      },
      {
        title: 'Menções de equipe',
        description: 'Notifique toda a equipe com menções especiais',
        type: 'feature',
        area: 'Chamados'
      },
      {
        title: 'Badge de notificações',
        description: 'Indicador visual de notificações não lidas no header',
        type: 'feature',
        area: 'Interface'
      }
    ]
  },
  {
    version: '1.2.0',
    date: '2025-12-15',
    title: 'Oráculo e Smith',
    features: [
      {
        title: 'Oráculo - Busca Inteligente',
        description: 'Sistema de busca avançada no histórico de chamados usando IA',
        type: 'feature',
        area: 'Oráculo'
      },
      {
        title: 'Smith - Base de Conhecimento',
        description: 'Chat com bases de conhecimento para ajudar nas respostas',
        type: 'feature',
        area: 'Smith'
      },
      {
        title: 'Pasquale - Melhoria de Textos',
        description: 'Use IA para melhorar a qualidade dos textos de resposta',
        type: 'feature',
        area: 'Pasquale'
      }
    ]
  },
  {
    version: '1.1.0',
    date: '2025-11-20',
    title: 'Gestão de Chamados',
    features: [
      {
        title: 'Central de Chamados',
        description: 'Interface completa para gerenciamento de chamados',
        type: 'feature',
        area: 'Chamados'
      },
      {
        title: 'Status de chamados',
        description: 'Controle de status: Aguardando, Em andamento, Concluído, Suspenso',
        type: 'feature',
        area: 'Chamados'
      },
      {
        title: 'Filtros e ordenação',
        description: 'Filtre chamados por status, VIP, data e outros critérios',
        type: 'feature',
        area: 'Chamados'
      },
      {
        title: 'Sistema de comentários',
        description: 'Adicione comentários e notas aos chamados',
        type: 'feature',
        area: 'Chamados'
      }
    ]
  },
  {
    version: '1.0.0',
    date: '2025-10-01',
    title: 'Lançamento Inicial',
    features: [
      {
        title: 'Sistema de autenticação',
        description: 'Login seguro com controle de acesso por equipe',
        type: 'feature',
        area: 'Sistema'
      },
      {
        title: 'Seleção de equipe',
        description: 'Escolha sua equipe para visualizar chamados específicos',
        type: 'feature',
        area: 'Sistema'
      },
      {
        title: 'Interface responsiva',
        description: 'Sistema funcional em desktop e dispositivos móveis',
        type: 'feature',
        area: 'Interface'
      }
    ]
  }
];

/**
 * Retorna a versão atual do sistema
 */
export const getCurrentVersion = (): Version => {
  return CHANGELOG.find(v => v.isCurrent) || CHANGELOG[0];
};

/**
 * Retorna o número da versão atual
 */
export const getCurrentVersionNumber = (): string => {
  return getCurrentVersion().version;
};
