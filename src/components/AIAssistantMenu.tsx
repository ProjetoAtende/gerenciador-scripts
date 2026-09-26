// components/AIAssistantMenu.tsx - Menu de assistente IA para o editor de scripts
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, CheckCircle, PenLine, AlignLeft, ScrollText, X, Loader2, AlertTriangle } from 'lucide-react';
import { callDeepseekRpc, extractDeepseekText } from '../services/deepseekRpcClient';
import { toast } from 'sonner';
import { 
  extractMediaFromHtml, 
  restoreMediaInHtml, 
  htmlContainsMedia,
  countMediaInHtml,
  MediaItem 
} from '../utils/mediaPlaceholders';

export type AIContext = 'default' | 'radar' | 'eproc' | 'escalacao_n3';

interface AIAssistantMenuProps {
  onInsertText: (text: string) => void;
  getFullText: () => string;
  aiContext?: AIContext;
}

export type AIAction = 'melhorar' | 'corrigir' | 'continuar' | 'formatar' | 'resumir';

const DEFAULT_AI_ACTIONS = [
  {
    id: 'melhorar' as AIAction,
    label: 'Melhorar Texto',
    icon: Wand2,
    description: 'Adiciona formatação, títulos, ícones e melhora a estrutura',
  },
  {
    id: 'corrigir' as AIAction,
    label: 'Corrigir Gramática',
    icon: CheckCircle,
    description: 'Corrige erros de gramática, pontuação e ortografia',
  },
  {
    id: 'continuar' as AIAction,
    label: 'Continuar Escrevendo',
    icon: PenLine,
    description: 'Continua o texto mantendo o mesmo estilo e contexto',
  },
  {
    id: 'formatar' as AIAction,
    label: 'Formatar Texto',
    icon: AlignLeft,
    description: 'Organiza com quebras de linha, espaçamentos e estrutura visual',
  },
];

const ESCALACAO_N3_AI_ACTIONS = [
  {
    id: 'resumir' as AIAction,
    label: 'Resumir Texto',
    icon: ScrollText,
    description: 'Resume o motivo do envio em, no máximo, 3 linhas objetivas',
  },
];

// Instrução adicional sobre placeholders de mídia (adicionada dinamicamente quando há mídias)
const MEDIA_PLACEHOLDER_INSTRUCTION = `
⚠️ IMPORTANTE - PLACEHOLDERS DE MÍDIA:
O texto contém marcadores no formato <!--MEDIA_X--> (onde X é um número).
Estes são placeholders para imagens/vídeos que foram removidos temporariamente.
- PRESERVE TODOS os placeholders <!--MEDIA_X--> exatamente como estão
- Mantenha-os nas mesmas posições relativas ao texto ao redor
- NÃO remova, altere ou mova os placeholders
- Trate-os como elementos visuais importantes do documento
`;

const PROMPTS_MELHORAR_RADAR = `Você é um assistente especializado em melhorar descrições de problemas técnicos para um sistema de rastreamento de tickets (Radar de Tickets).

O objetivo é tornar a descrição do problema mais clara, estruturada e compreensível para outros técnicos que precisam entender e resolver o problema.

Sua tarefa é:
1. Melhorar a clareza e organização do texto, tornando a descrição do problema mais precisa
2. Estruturar o texto para facilitar o entendimento: separar sintomas, impacto e contexto
3. Adicionar formatação HTML para melhor legibilidade:
   - Use <strong>negrito</strong> para destacar pontos críticos (sistemas afetados, erros, etc.)
   - Use <em>itálico</em> para observações e detalhes complementares
   - Use <h4> para subtítulos quando houver seções distintas (ex: "Problema", "Impacto", "Contexto")
   - Use listas <ul>/<ol> para enumerar sintomas, passos ou sistemas afetados
   - Use <br> para quebras de linha adequadas
4. Adicionar emojis relevantes para categorização visual (🔴 crítico, ⚠️ atenção, 📋 detalhes, 🔧 técnico, 💡 observação)
5. Manter tom técnico e objetivo — NÃO é uma resposta ao usuário, é uma descrição interna do problema

IMPORTANTE:
- NÃO transforme em resposta de atendimento ao cliente
- NÃO adicione saudações, despedidas ou frases de cortesia
- Mantenha o foco em descrever o problema com clareza técnica
- Preserve informações técnicas exatas (números, códigos, sistemas, etc.)
- NÃO adicione informações factuais que não estavam no texto original
- Retorne APENAS o texto melhorado em HTML, sem explicações ou comentários
- Use formatação HTML, NÃO Markdown
- O texto resultante deve ser mais claro e estruturado que o original, NUNCA mais curto`;

const PROMPTS_MELHORAR_EPROC = `Você é um assistente especializado em melhorar propostas de melhoria para o sistema Eproc (sistema judicial eletrônico).

O objetivo é tornar a descrição da melhoria proposta mais clara, bem fundamentada e compreensível para quem vai avaliar e implementar.

Sua tarefa é:
1. Melhorar a clareza e organização da proposta, detalhando o que se pretende
2. Estruturar o texto com foco em: o que mudar, por que mudar e qual o benefício esperado
3. Adicionar formatação HTML para melhor legibilidade:
   - Use <strong>negrito</strong> para destacar funcionalidades, módulos e conceitos-chave
   - Use <em>itálico</em> para observações e notas complementares
   - Use <h4> para subtítulos quando houver seções distintas (ex: "Proposta", "Benefícios", "Cenário Atual")
   - Use listas <ul>/<ol> para enumerar funcionalidades, etapas ou benefícios
   - Use <br> para quebras de linha adequadas
4. Adicionar emojis relevantes para categorização visual (✅ benefício, 📋 detalhes, 🔧 técnico, 💡 sugestão, ⚠️ atenção)
5. Manter tom propositivo, técnico e objetivo — é uma proposta de melhoria, não uma resposta a um chamado

IMPORTANTE:
- NÃO transforme em resposta de atendimento ao cliente
- NÃO adicione saudações, despedidas ou frases de cortesia
- Mantenha o foco em descrever a melhoria proposta com clareza
- Preserve informações técnicas exatas (nomes de módulos, telas, funcionalidades)
- NÃO adicione informações factuais que não estavam no texto original
- Retorne APENAS o texto melhorado em HTML, sem explicações ou comentários
- Use formatação HTML, NÃO Markdown
- O texto resultante deve ser mais claro e bem estruturado que o original, NUNCA mais curto`;

const PROMPTS: Record<AIAction, string> = {
  melhorar: `Você é um assistente especializado em melhorar textos para scripts de atendimento ao cliente, com um tom acolhedor, empático e humanizado.

Sua tarefa é:
1. Melhorar a estrutura e organização do texto, tornando-o mais completo e detalhado
2. Expandir o texto quando ele for muito curto ou telegráfico — adicione contexto e cordialidade SEM inventar informações
3. Adicionar formatação HTML para melhor legibilidade:
   - Use <strong>negrito</strong> para destacar pontos importantes
   - Use <em>itálico</em> para ênfases suaves, observações e notas complementares
   - Use <h3> ou <h4> para subtítulos quando apropriado
   - Use listas <ul>/<ol> para enumerar itens
   - Use <br> para quebras de linha adequadas
4. Adicionar emojis/ícones relevantes para tornar o texto mais visual e caloroso (📌, ✅, ⚠️, 💡, 📋, 🔧, etc.)
5. Aplicar tabulação e indentação para melhor hierarquia visual
6. Usar linguagem acolhedora, próxima do usuário — como uma pessoa atenciosa escrevendo, não um documento burocrático

Exemplo de tom desejado:
- ANTES: "Prezado usuário, poderia informar o número do processo?"
- DEPOIS: "Prezado(a) Usuário(a),<br>Para um <strong>atendimento mais ágil e preciso</strong> ao seu chamado, solicitamos gentilmente uma informação adicional:<br>Por favor, poderia nos informar o <strong>número do processo</strong> relacionado à situação descrita em seu chamado?<br>💡 <em>Esta informação é fundamental para que nossa equipe localize e analise o caso com a maior eficiência possível.</em><br>Agradecemos seu contato e permanecemos à disposição!"

IMPORTANTE:
- Mantenha o significado e intenção original do texto
- Preserve informações técnicas exatas (números, códigos, etc.)
- NÃO adicione informações factuais que não estavam no texto original
- PODE adicionar frases de cortesia, empatia e explicações sobre o motivo de solicitar algo
- Retorne APENAS o texto melhorado em HTML, sem explicações ou comentários
- Use formatação HTML, NÃO Markdown
- O texto resultante deve ser mais completo e humanizado que o original, NUNCA mais curto`,

  corrigir: `Você é um assistente especializado em correção gramatical.

Sua tarefa é:
1. Corrigir erros de gramática
2. Corrigir erros de pontuação
3. Corrigir erros de ortografia
4. Corrigir erros de concordância verbal e nominal

IMPORTANTE:
- NÃO altere o estilo ou estrutura do texto
- NÃO adicione formatação extra
- Mantenha o texto exatamente como está, apenas corrija os erros
- Se o texto estiver em HTML, preserve toda a formatação HTML
- Retorne APENAS o texto corrigido, sem explicações`,

  continuar: `Você é um assistente especializado em continuar textos de scripts de atendimento.

Sua tarefa é:
1. Analisar o contexto e estilo do texto fornecido
2. Continuar escrevendo de forma natural e coerente
3. Manter o mesmo tom e linguagem do texto original
4. Adicionar conteúdo relevante que complemente o que já foi escrito

IMPORTANTE:
- Mantenha consistência com o estilo do texto original
- Se o texto usa formatação HTML, continue usando HTML
- Adicione de 2 a 4 parágrafos de conteúdo relevante
- Retorne APENAS a continuação do texto, sem repetir o texto original
- Use formatação HTML se o texto original usar HTML`,

  formatar: `Você é um especialista em formatação de textos HTML para scripts de atendimento ao cliente, com tom acolhedor, empático e humanizado.

Sua tarefa é transformar o texto recebido em um HTML profissional, rico visualmente e caloroso — como uma pessoa atenciosa escrevendo, não um documento burocrático.

**FORMATAÇÃO HTML OBRIGATÓRIA:**

1. **Estrutura Geral:**
   - Use <p> para parágrafos
   - Use <br> para quebras de linha dentro de parágrafos
   - Adicione espaçamento adequado entre seções
   - Expanda frases telegráficas com cordialidade e contexto (SEM inventar informações)

2. **Títulos e Subtítulos:**
   - Use <h4> para títulos de seção (ex: "Procedimentos:", "Informações Importantes:")
   - Adicione emojis relevantes nos títulos (📌, 📋, ⚠️, ✅, 💡, 📍, 🔗, 📧, 📞)

3. **Ênfases:**
   - Use <strong> para termos importantes, nomes de sistemas, botões, campos
   - Use <em>itálico</em> para observações, notas, dicas e frases de empatia
   - Destaque palavras-chave relevantes

4. **Tom humanizado:**
   - Adicione frases de empatia quando pertinente (ex: 💡 <em>Esta informação é fundamental para que nossa equipe localize e analise o caso com eficiência.</em>)
   - Use linguagem próxima do usuário, não corporativa
   - Inclua frases de cortesia na abertura e encerramento quando não existirem

5. **Listas:**
   - Use <ol> para passos sequenciais numerados
   - Use <ul> para itens não ordenados
   - Use <li> para cada item

6. **Links/URLs:**
   ⚠️ MUITO IMPORTANTE: Transforme TODOS os links crus em links clicáveis HTML!
   - URLs brutas como "https://exemplo.com" devem virar:
     <a href="https://exemplo.com" target="_blank" rel="noopener noreferrer">https://exemplo.com</a>
   - NUNCA deixe URLs como texto puro

7. **Estrutura de E-mail Profissional:**
   - Saudação calorosa no início
   - Corpo organizado em parágrafos/seções com empatia
   - Links em destaque (cada um em linha própria se necessário)
   - Despedida encorajadora e assinatura no final

**REGRAS CRÍTICAS - NUNCA VIOLE:**

❌ NUNCA ALTERE estas estruturas especiais (são dropdowns do sistema):
   • {[opção1][opção2][opção3]} - Mantenha EXATAMENTE assim
   • () - Campos editáveis, manter EXATAMENTE assim
   • NÃO converta {[Prezado][Prezada]} para "Prezado(a)"
   • NÃO remova chaves {} ou colchetes [] dessas estruturas
   • Se o texto começar com "Prezado usuário" (ou "Prezada usuária"), mantenha EXATAMENTE como está

❌ NUNCA altere:
   • Números de processo, protocolos, códigos
   • Datas e horários
   • Nomes próprios
   • Informações técnicas específicas

✅ SEMPRE faça:
   • Retorne HTML puro, sem blocos de código ou markdown
   • Mantenha TODO o conteúdo original
   • Transforme URLs em links clicáveis
   • Adicione formatação visual rica e tom humanizado
   • O texto resultante deve ser mais completo e caloroso que o original, NUNCA mais seco

**EXEMPLO DE ENTRADA:**
"Prezado usuário, poderia informar o número do processo? Agradecemos. SGS 2.2.2"

**EXEMPLO DE SAÍDA:**
<p>Prezado(a) Usuário(a),</p>
<p>Para que possamos oferecer um <strong>atendimento mais ágil e eficiente</strong> ao seu chamado, gostaríamos de solicitar uma informação adicional.</p>
<p>Por favor, poderia nos informar o <strong>número do processo</strong> relacionado à sua solicitação?</p>
<p>💡 <em>Essa informação é essencial para que nossa equipe consiga localizar e analisar o seu caso com a maior precisão possível.</em></p>
<p>Agradecemos sinceramente pelo seu contato e estamos à disposição para ajudar no que for necessário!</p>
<p>SGS 2.2.2</p>

Retorne APENAS o HTML formatado, sem explicações, comentários ou blocos de código.`,

  resumir: `Você é um assistente especializado em resumir textos técnicos para o campo "Motivo de Envio" de uma escalação N3.

Sua tarefa é:
1. Resumir TODO o conteúdo informado de forma fiel e objetiva
2. Preservar os fatos principais, sistema citado, problema central e contexto essencial
3. Reduzir o texto final para, no máximo, 3 linhas curtas de leitura
4. Retornar um texto enxuto, claro e útil para triagem técnica

IMPORTANTE:
- NÃO invente informações
- NÃO adicione saudações, títulos, marcadores ou explicações extras
- NÃO use Markdown
- Retorne apenas HTML simples, usando no máximo 3 parágrafos curtos com <p> ou um único <p>
- O resultado deve servir como um "Motivo de Envio" resumido`,
};

/**
 * Valida se o texto retornado pela IA é aceitável comparado ao original.
 * Protege contra respostas vazias, truncadas ou destrutivas.
 * Exportada para permitir testes unitários.
 */
export function validateAIResult(original: string, result: string, action: AIAction): { ok: boolean; reason?: string } {
  // Extrair apenas texto visível (sem tags HTML) para comparar comprimentos
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  const originalPlain = stripHtml(original);
  const resultPlain = stripHtml(result);

  // 1. Resultado vazio ou quase vazio
  if (resultPlain.length < 10 && originalPlain.length > 20) {
    return { ok: false, reason: 'A IA retornou um texto praticamente vazio. A alteração foi descartada para proteger seu conteúdo.' };
  }

  // 2. Para ações que não devem reduzir muito o texto (melhorar, corrigir, formatar)
  if (action !== 'continuar' && action !== 'resumir') {
    const ratio = resultPlain.length / Math.max(originalPlain.length, 1);
    // Se o resultado tem menos de 30% do tamanho original, é suspeito
    if (ratio < 0.3 && originalPlain.length > 30) {
      return {
        ok: false,
        reason: `A IA reduziu o texto para ${Math.round(ratio * 100)}% do original. A alteração foi descartada para proteger seu conteúdo.`,
      };
    }
  }

  return { ok: true };
}

function looksLikeReasoningLeak(text: string): boolean {
  const normalized = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized) return false;

  return [
    'preciso resumir',
    'vou criar um resumo',
    'vou tentar',
    'não usar markdown',
    'retornar apenas html',
    'o usuário forneceu',
    'devo preservar fatos principais',
    'talvez um único',
    'máximo 3 linhas',
  ].some(marker => normalized.includes(marker));
}

function getMelhorarPrompt(context: AIContext): string {
  switch (context) {
    case 'radar': return PROMPTS_MELHORAR_RADAR;
    case 'eproc': return PROMPTS_MELHORAR_EPROC;
    default: return PROMPTS.melhorar;
  }
}

function getActionsForContext(context: AIContext) {
  return context === 'escalacao_n3' ? ESCALACAO_N3_AI_ACTIONS : DEFAULT_AI_ACTIONS;
}

function buildLocalSummaryFromHtml(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!text) {
    return '';
  }

  const sentences = text
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((sentence) => !/^(prezado[sa]?|ol[aá]|bom dia|boa tarde|boa noite|atenciosamente)[,!\.]?$/i.test(sentence))
    .filter((sentence) => !/^(prezado[sa]?|ol[aá]|bom dia|boa tarde|boa noite)[,\s]/i.test(sentence))
    .filter((sentence) => !/^atenciosamente[,!\.]?$/i.test(sentence));

  const priorityPatterns = [
    /(multa|penalidade|condena[cç][aã]o)/i,
    /(leitura|ci[eê]ncia|confirma[cç][aã]o|domic[ií]lio judicial eletr[oô]nico)/i,
    /(falha|inconsist[eê]ncia|diverg[eê]ncia|verifica[cç][aã]o|an[aá]lise)/i,
    /(processo n[ºo]|processo\s+\d)/i,
  ];

  const scoredSentences = sentences
    .map((sentence, index) => {
      const score = priorityPatterns.reduce((total, pattern, patternIndex) => (
        pattern.test(sentence) ? total + (priorityPatterns.length - patternIndex) * 10 : total
      ), 0) + Math.max(0, 5 - index);

      return { sentence, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const lines: string[] = [];
  let current = '';

  for (const sentence of scoredSentences) {
    const normalized = sentence.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;

    const candidate = current ? `${current} ${normalized}` : normalized;
    if (candidate.length <= 170) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = normalized.length <= 170 ? normalized : `${normalized.slice(0, 167).trimEnd()}...`;

    if (lines.length === 2) {
      break;
    }
  }

  if (current && lines.length < 3) {
    lines.push(current);
  }

  if (lines.length === 0) {
    lines.push(text.length <= 170 ? text : `${text.slice(0, 167).trimEnd()}...`);
  }

  return lines.slice(0, 3).map((line) => `<p>${line}</p>`).join('');
}

export const AIAssistantMenu = ({
  onInsertText,
  getFullText,
  aiContext = 'default',
}: AIAssistantMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<AIAction | null>(null);
  const [pendingResult, setPendingResult] = useState<{ text: string; action: AIAction; originalText: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actions = getActionsForContext(aiContext);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = async (action: AIAction) => {
    const textToProcess = getFullText();
    
    if (!textToProcess.trim()) {
      toast.error('Não há texto para processar. Digite algo no editor primeiro.');
      return;
    }

    setLoading(true);
    setLoadingAction(action);

    // Variáveis para o sistema de placeholders de mídia
    let mediaItems: MediaItem[] = [];
    let textForAI = textToProcess;
    const hasMedia = htmlContainsMedia(textToProcess);

    try {
      // Se o texto contém mídias, extrair e substituir por placeholders
      if (hasMedia) {
        const mediaCount = countMediaInHtml(textToProcess);
        console.log(`🖼️ Texto contém mídias: ${mediaCount.images} imagens, ${mediaCount.videos} vídeos, ${mediaCount.iframes} iframes`);
        
        const extraction = extractMediaFromHtml(textToProcess);
        textForAI = extraction.cleanHtml;
        mediaItems = extraction.mediaItems;
        
        console.log(`📋 Extraídas ${mediaItems.length} mídias, substituídas por placeholders`);
        toast.info(`Processando texto com ${mediaCount.total} mídia(s)...`);
      }

      // Construir o prompt com instrução adicional sobre placeholders se necessário
      let prompt = action === 'melhorar' ? getMelhorarPrompt(aiContext) : PROMPTS[action];
      if (hasMedia && mediaItems.length > 0) {
        prompt = prompt + MEDIA_PLACEHOLDER_INSTRUCTION;
      }

      const messages = [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: action === 'continuar' 
            ? `Continue o seguinte texto:\n\n${textForAI}`
            : textForAI,
        },
      ];

      // Chamar DeepSeek via Supabase RPC (resolve CORS)
      const { data, error } = await callDeepseekRpc(messages, {
        model: 'deepseek-v4-flash',
        temperature: action === 'continuar' ? 0.7 : 0.3,
        maxTokens: action === 'resumir' ? 220 : 4096,
        responseFormat: null,
        thinking: null,
      });

      if (error) {
        console.error('Erro RPC:', error);
        toast.error(`Erro ao processar: ${error.message}`);
        return;
      }

      if (data?.error) {
        console.error('Erro retornado pela função:', data.error);
        toast.error(data.error.message || 'Erro ao processar texto');
        return;
      }

      const resultText = extractDeepseekText(data);
      
      if (!resultText) {
        if (action === 'resumir') {
          const fallbackSummary = buildLocalSummaryFromHtml(textToProcess);
          if (fallbackSummary) {
            onInsertText(fallbackSummary);
            toast.success('Texto resumido com fallback local.');
            setIsOpen(false);
            return;
          }
        }

        toast.error('Resposta vazia da IA');
        return;
      }

      if (action === 'resumir' && looksLikeReasoningLeak(resultText)) {
        const fallbackSummary = buildLocalSummaryFromHtml(textToProcess);
        if (fallbackSummary) {
          onInsertText(fallbackSummary);
          toast.success('Texto resumido com sucesso!');
          setIsOpen(false);
          return;
        }

        toast.error('A IA retornou um rascunho interno em vez do resumo final.');
        return;
      }

      // Processar o texto conforme a ação
      let processedText = resultText;
      
      // Para "formatar", o prompt já retorna HTML formatado
      // Apenas limpar possíveis blocos de código markdown que a IA possa ter adicionado
      if (action === 'formatar' || action === 'resumir') {
        // Remover blocos de código markdown se a IA os incluir
        processedText = resultText
          .replace(/^```html?\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
      }

      // Restaurar mídias se foram extraídas
      if (hasMedia && mediaItems.length > 0) {
        console.log(`🔄 Restaurando ${mediaItems.length} mídias no texto processado...`);
        processedText = restoreMediaInHtml(processedText, mediaItems);
        console.log('✅ Mídias restauradas com sucesso');
      }

      // Montar o texto final
      let finalText: string;
      if (action === 'continuar') {
        const originalWithMedia = hasMedia ? textToProcess : textForAI;
        finalText = originalWithMedia + '\n\n' + processedText;
      } else {
        finalText = processedText;
      }

      // Validar resultado antes de aplicar
      const validation = validateAIResult(textToProcess, finalText, action);
      if (!validation.ok) {
        console.warn('[IA] Resultado rejeitado:', validation.reason);
        toast.error(validation.reason ?? 'Resultado da IA rejeitado por segurança.');
        return;
      }

      // Verificar redução moderada (30-60%) — pedir confirmação
      if (action !== 'continuar' && action !== 'resumir') {
        const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        const ratio = stripHtml(finalText).length / Math.max(stripHtml(textToProcess).length, 1);
        if (ratio < 0.6 && stripHtml(textToProcess).length > 50) {
          // Guardar para confirmação
          setPendingResult({ text: finalText, action, originalText: textToProcess });
          setIsOpen(false);
          return;
        }
      }

      // Aplicar diretamente
      onInsertText(finalText);
      toast.success(
        action === 'melhorar' ? 'Texto melhorado com sucesso!' :
        action === 'corrigir' ? 'Gramática corrigida!' :
        action === 'resumir' ? 'Texto resumido com sucesso!' :
        action === 'formatar' ? 'Texto formatado com sucesso!' :
        'Texto continuado com sucesso!'
      );
      setIsOpen(false);
    } catch (err) {
      console.error('Erro ao processar com IA:', err);
      toast.error('Erro ao processar texto com IA');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Botão IA */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors flex items-center gap-1 ${
          isOpen ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'text-purple-600 dark:text-purple-400'
        }`}
        title="Assistente IA"
        disabled={loading}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        <span className="text-xs font-medium hidden sm:inline">IA</span>
      </button>

      {/* Menu Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 w-80"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 dark:from-purple-900/30 to-pink-50 dark:to-pink-900/30 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600" />
                <span className="font-semibold text-gray-800 dark:text-gray-100">Assistente IA</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/50 rounded transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Actions */}
            <div className="p-2">
              {actions.map((action) => {
                const Icon = action.icon;
                const isLoading = loadingAction === action.id;
                
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action.id)}
                    disabled={loading}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                      loading 
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-purple-50 dark:hover:bg-purple-900/20'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      action.id === 'melhorar' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                      action.id === 'corrigir' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                      action.id === 'resumir' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                      action.id === 'formatar' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Icon size={18} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {action.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {action.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Powered by DeepSeek AI — aplica ao texto completo
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmação para reduções suspeitas */}
      <AnimatePresence>
        {pendingResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setPendingResult(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-700 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-t-2xl flex items-center gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Verificação de segurança</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">O texto retornado pela IA é significativamente menor que o original</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  A IA reduziu o conteúdo do texto. Isso pode indicar perda de informação.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      onInsertText(pendingResult.text);
                      toast.success('Alteração aplicada.');
                      setPendingResult(null);
                    }}
                    className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    Aplicar mesmo assim
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Alteração descartada. Texto original mantido.');
                      setPendingResult(null);
                    }}
                    className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
