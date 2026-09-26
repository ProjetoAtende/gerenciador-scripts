import { callDeepseekRpc } from './deepseekRpcClient';

export interface MelhorarTextoResponse {
  textoMelhorado: string;
  erro?: string;
}

export const PROMPT_SISTEMA_OUVIDORIA = `Você é um redator especializado em respostas formais de Ouvidoria do Poder Judiciário.

OBJETIVO
Reescrever o texto fornecido pelo usuário melhorando escrita, coesão, clareza e formalidade, sem alterar fatos, datas, nomes, números de protocolo, números de processo, números de chamado ou qualquer informação técnica.

REGRAS OBRIGATÓRIAS DE FORMA
1. O texto DEVE começar exatamente com a fórmula: "Trata-se de [síntese do problema], apresentado(a) por [identificação do manifestante]" — adaptando concordância de gênero/número conforme o caso.
2. O texto DEVE terminar exatamente com a frase: "É o que nos cumpre informar." (com ponto final).
3. Use sempre linguagem formal, em terceira pessoa do singular ou plural impessoal. Nunca use primeira pessoa ("eu", "nós") fora da fórmula final.
4. Separe parágrafos por uma linha em branco. Não use marcadores, listas com hífen, listas numeradas, emojis, negrito, itálico, títulos ou qualquer outra formatação Markdown — produza texto corrido puro.
5. Evite repetições desnecessárias de nomes próprios; após a primeira menção, prefira "o usuário", "o manifestante", "o requerente", "o(a) advogado(a)", "o(a) perito(a)", conforme o caso.
6. Não invente informações, não acrescente conclusões que não estejam no material original e não omita fatos relevantes apresentados.

REGRAS DE CONTEÚDO
- Preserve literalmente: protocolos (ex.: nº 2026/00046797), números de processo (ex.: 4039900-14.2026.8.26.0000), números de chamado (ex.: 81811972), datas, horários, siglas técnicas, nomes próprios.
- Mantenha a ordem cronológica dos fatos quando ela existir.
- Se houver conclusão sobre solução/encerramento da demanda no texto original, preserve-a antes da fórmula final.

INTEGRAÇÃO PROBLEMA + RESOLUÇÃO
- Quando o usuário fornecer um campo "PROBLEMA", utilize-o como base da síntese do parágrafo de abertura ("Trata-se de…").
- Quando a "RESOLUÇÃO" já contiver uma abertura no formato "Trata-se de…" e o "PROBLEMA" também tiver sido fornecido, FUNDA as duas informações em um único parágrafo de abertura, priorizando a síntese do "PROBLEMA" e eliminando a abertura redundante da "RESOLUÇÃO". Não duplique a abertura.
- Quando o "PROBLEMA" não for fornecido, extraia a síntese de abertura a partir da própria "RESOLUÇÃO".

SAÍDA
Retorne APENAS o texto reescrito, em texto puro, sem nenhum comentário, explicação, prefixo ou aspas envolvendo o resultado.`;

const PROMPT_SISTEMA_PADRAO = `Você é um assistente especializado em melhorar textos de atendimento ao cliente, com um estilo caloroso, empático e próximo do usuário.

Sua tarefa é:
1. Corrigir pontuação, concordância e gramática
2. Melhorar a escrita tornando-a clara, acolhedora e amigável — sem ser excessivamente formal ou seca
3. Organizar o texto com subtítulos quando apropriado
4. Aplicar formatação Markdown:
   - Use **negrito** para destacar pontos importantes
   - Use *itálico* para ênfase suave
   - Use ### para subtítulos quando necessário
   - Use emojis relevantes para tornar o texto mais visual e acolhedor (ex: ✅ para confirmações, ⚠️ para alertas, 📋 para listas, 🔧 para aspectos técnicos)

IMPORTANTE:
- Mantenha o significado e intenção original do texto
- Preserve informações técnicas exatas (números de chamado, códigos, etc)
- Não adicione informações que não estavam no texto original
- Retorne APENAS o texto melhorado, sem explicações ou comentários adicionais
- Use linguagem acessível, próxima e humanizada — como se fosse uma pessoa atenciosa escrevendo, não um documento corporativo`;

export const melhorarTextoComIA = async (textoOriginal: string, promptCustomizado?: string): Promise<MelhorarTextoResponse> => {
  if (!textoOriginal.trim()) {
    return {
      textoMelhorado: '',
      erro: 'Texto vazio'
    };
  }

  try {
    // Usar prompt customizado se fornecido, caso contrário usar o padrão
    const promptSistema = promptCustomizado || PROMPT_SISTEMA_PADRAO;
    const promptUsuario = promptCustomizado 
      ? `${promptCustomizado}\n\nTexto:\n\n${textoOriginal}`
      : `Melhore o seguinte texto:\n\n${textoOriginal}`;

    const messages = [
      {
        role: 'system',
        content: promptCustomizado ? 'Você é um assistente de IA especializado em processamento de texto. Siga as instruções do usuário com precisão.' : promptSistema
      },
      {
        role: 'user',
        content: promptUsuario
      }
    ];

    let data: any = null;

    // ESTRATÉGIA 1: Tentar via função RPC do Supabase (resolve CORS)
    const { data: rpcData, error: rpcError } = await callDeepseekRpc(messages, {
      model: 'deepseek-v4-flash',
      temperature: 0.3,
      maxTokens: 4096,
      responseFormat: null,
      thinking: null,
    });

    console.log('RPC Response:', { rpcData, rpcError });

    if (rpcError) {
      // RPC falhou - verificar tipo de erro
      console.error('Erro RPC:', rpcError);
      return {
        textoMelhorado: textoOriginal,
        erro: `Erro na função RPC: ${rpcError.message}. Verifique se a função chamar_deepseek existe no Supabase.`
      };
    }

    if (rpcData?.error) {
      // RPC executou mas retornou erro
      console.error('Erro retornado pela função:', rpcData.error);
      return {
        textoMelhorado: textoOriginal,
        erro: rpcData.error.message || 'Erro na função DeepSeek'
      };
    }

    data = rpcData;

    if (!data?.choices?.[0]?.message) {
      throw new Error('Resposta da API inválida');
    }

    const textoMelhorado = data.choices[0].message.content.trim();

    return {
      textoMelhorado
    };
  } catch (error) {
    console.error('Erro ao melhorar texto com IA:', error);
    return {
      textoMelhorado: textoOriginal,
      erro: error instanceof Error ? error.message : 'Erro desconhecido ao processar texto'
    };
  }
};

export interface MelhorarOuvidoriaParams {
  resolucao: string;
  problema?: string;
  promptOverride?: string;
}

/**
 * Pasquale — Modo Ouvidoria.
 * Reescreve a resolução em formato formal de Ouvidoria, integrando o problema
 * informado (quando houver) sem duplicar a abertura "Trata-se de…".
 */
export const melhorarTextoOuvidoria = async (
  params: MelhorarOuvidoriaParams
): Promise<MelhorarTextoResponse> => {
  const resolucao = params.resolucao?.trim() ?? '';
  const problema = params.problema?.trim() ?? '';
  const promptOverride = params.promptOverride?.trim() ?? '';

  if (!resolucao) {
    return {
      textoMelhorado: '',
      erro: 'O campo "Resolução" é obrigatório.'
    };
  }

  try {
    const promptSistema = promptOverride || PROMPT_SISTEMA_OUVIDORIA;

    const partesUsuario: string[] = [];
    if (problema) {
      partesUsuario.push(`PROBLEMA (síntese a ser usada na abertura "Trata-se de…"):\n${problema}`);
    } else {
      partesUsuario.push('PROBLEMA: (não fornecido — extrair síntese diretamente da RESOLUÇÃO abaixo)');
    }
    partesUsuario.push(`RESOLUÇÃO (texto principal a ser reescrito):\n${resolucao}`);
    partesUsuario.push(
      'Reescreva conforme as REGRAS do system prompt. Retorne apenas o texto final em texto puro, começando com "Trata-se de…" e terminando com "É o que nos cumpre informar.".'
    );

    const messages = [
      { role: 'system', content: promptSistema },
      { role: 'user', content: partesUsuario.join('\n\n') }
    ];

    const { data: rpcData, error: rpcError } = await callDeepseekRpc(messages, {
      model: 'deepseek-v4-flash',
      temperature: 0.2,
      maxTokens: 4096,
      responseFormat: null,
      thinking: null,
    });

    if (rpcError) {
      console.error('Erro RPC (ouvidoria):', rpcError);
      return {
        textoMelhorado: resolucao,
        erro: `Erro na função RPC: ${rpcError.message}.`
      };
    }

    if (rpcData?.error) {
      console.error('Erro retornado pela função (ouvidoria):', rpcData.error);
      return {
        textoMelhorado: resolucao,
        erro: rpcData.error.message || 'Erro na função DeepSeek'
      };
    }

    if (!rpcData?.choices?.[0]?.message) {
      return {
        textoMelhorado: resolucao,
        erro: 'Resposta da API inválida'
      };
    }

    const textoMelhorado = (rpcData.choices[0].message.content as string).trim();

    return { textoMelhorado };
  } catch (error) {
    console.error('Erro ao processar ouvidoria com IA:', error);
    return {
      textoMelhorado: resolucao,
      erro: error instanceof Error ? error.message : 'Erro desconhecido ao processar texto'
    };
  }
};
