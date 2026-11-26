/**
 * Troca de senha pelo próprio usuário (Configurações).
 *
 * 1. Confere a senha atual entrando de novo com ela. Assim, quem encontrar o
 *    Gerenciador aberto num computador não consegue trocar a senha de outra
 *    pessoa. O novo login também atende à exigência de "login recente" do
 *    Supabase para trocar a senha.
 * 2. Grava a nova senha com `auth.updateUser` (função pronta do Supabase: não
 *    precisa de Edge Function nem de migration).
 *
 * O mínimo de 6 caracteres é o mesmo que o Boss Only exige ao criar ou
 * redefinir senhas (Edge Function `admin-users`).
 */
import { supabase } from './supabaseClient';

export const SENHA_TAMANHO_MINIMO = 6;

export interface TrocaSenhaEntrada {
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
}

export type ResultadoTrocaSenha = { ok: true } | { ok: false; erro: string; campo?: keyof TrocaSenhaEntrada };

/** Validação local, antes de falar com o servidor. Devolve null se estiver tudo certo. */
export function validarTrocaSenha(e: TrocaSenhaEntrada): Extract<ResultadoTrocaSenha, { ok: false }> | null {
  if (!e.senhaAtual) return { ok: false, erro: 'Informe sua senha atual.', campo: 'senhaAtual' };
  if (e.novaSenha.length < SENHA_TAMANHO_MINIMO) {
    return { ok: false, erro: `A nova senha deve ter pelo menos ${SENHA_TAMANHO_MINIMO} caracteres.`, campo: 'novaSenha' };
  }
  if (e.novaSenha === e.senhaAtual) {
    return { ok: false, erro: 'A nova senha precisa ser diferente da atual.', campo: 'novaSenha' };
  }
  if (e.novaSenha !== e.confirmacao) {
    return { ok: false, erro: 'A confirmação não confere com a nova senha.', campo: 'confirmacao' };
  }
  return null;
}

function mensagemDoErro(erro: { message?: string; code?: string; status?: number }): string {
  const codigo = erro.code ?? '';
  const texto = (erro.message ?? '').toLowerCase();
  if (codigo === 'same_password' || texto.includes('different from the old password')) {
    return 'A nova senha precisa ser diferente da atual.';
  }
  if (codigo === 'weak_password' || texto.includes('weak') || texto.includes('at least')) {
    return 'A nova senha é muito fraca. Use uma senha mais longa, misturando letras e números.';
  }
  if (codigo === 'over_request_rate_limit' || erro.status === 429) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  }
  return 'Não foi possível trocar a senha agora. Tente novamente em instantes.';
}

export async function trocarMinhaSenha(entrada: TrocaSenhaEntrada): Promise<ResultadoTrocaSenha> {
  const invalida = validarTrocaSenha(entrada);
  if (invalida) return invalida;

  const { data: sessao } = await supabase.auth.getSession();
  const email = sessao.session?.user?.email;
  if (!email) return { ok: false, erro: 'Sua sessão expirou. Entre de novo no Gerenciador e tente outra vez.' };

  const { error: erroLogin } = await supabase.auth.signInWithPassword({ email, password: entrada.senhaAtual });
  if (erroLogin) {
    const credencialErrada =
      erroLogin.code === 'invalid_credentials' || (erroLogin.message ?? '').toLowerCase().includes('invalid login credentials');
    return credencialErrada
      ? { ok: false, erro: 'A senha atual não está correta.', campo: 'senhaAtual' }
      : { ok: false, erro: mensagemDoErro(erroLogin) };
  }

  const { error: erroTroca } = await supabase.auth.updateUser({ password: entrada.novaSenha });
  if (erroTroca) return { ok: false, erro: mensagemDoErro(erroTroca), campo: 'novaSenha' };

  return { ok: true };
}
