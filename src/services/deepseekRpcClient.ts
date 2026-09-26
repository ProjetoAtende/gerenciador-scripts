import { supabase } from './supabaseClient';

export type DeepseekMessage = {
  role: string;
  content: string;
};

type DeepseekRpcOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: Record<string, unknown> | null;
  thinking?: Record<string, unknown> | null;
};

type DeepseekRpcResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    details?: string;
    sqlstate?: string;
  };
};

type DeepseekRpcResult = {
  data: DeepseekRpcResponse | null;
  error: Error | null;
};

const DEFAULT_MODEL = 'deepseek-v4-flash';

function isLegacyDeepseekRpcSignatureError(error: Error | null) {
  if (!error?.message) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('could not choose the best candidate function') ||
    message.includes('function public.chamar_deepseek') ||
    message.includes('find the function public.chamar_deepseek')
  );
}

export function extractDeepseekText(data: DeepseekRpcResponse | null | undefined): string {
  const message = data?.choices?.[0]?.message;
  const content = message?.content?.trim();
  if (content) return content;

  const reasoningContent = message?.reasoning_content?.trim();
  if (reasoningContent) return reasoningContent;

  return '';
}

export async function callDeepseekRpc(
  messages: DeepseekMessage[],
  options: DeepseekRpcOptions = {}
): Promise<DeepseekRpcResult> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.3,
    maxTokens = 4096,
    responseFormat = null,
    thinking = null,
  } = options;

  try {
    const payload = {
      p_messages: messages,
      p_model: model,
      p_temperature: temperature,
      p_max_tokens: maxTokens,
      p_response_format: responseFormat,
      p_thinking: thinking,
    };

    let { data, error } = await supabase.rpc('chamar_deepseek', payload);

    // Compatibilidade defensiva:
    // alguns ambientes ainda podem estar só com a assinatura antiga (4 args)
    // ou momentaneamente com conflito de overload. Nesses casos, tentamos o
    // fallback sem os parâmetros JSON opcionais.
    if (error && isLegacyDeepseekRpcSignatureError(error)) {
      const fallbackResult = await supabase.rpc('chamar_deepseek', {
        p_messages: messages,
        p_model: model,
        p_temperature: temperature,
        p_max_tokens: maxTokens,
      });

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      return { data: null, error };
    }

    return {
      data: (data ?? {}) as DeepseekRpcResponse,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Erro ao chamar DeepSeek RPC'),
    };
  }
}

export async function getDeepseekText(
  messages: DeepseekMessage[],
  options: DeepseekRpcOptions = {}
): Promise<string> {
  const { data, error } = await callDeepseekRpc(messages, options);

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro no provider LLM');
  }

  const content = extractDeepseekText(data);
  if (!content) {
    throw new Error('Resposta vazia da IA');
  }

  return content;
}
