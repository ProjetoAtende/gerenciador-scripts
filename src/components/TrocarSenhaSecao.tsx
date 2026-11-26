// src/components/TrocarSenhaSecao.tsx
// Bloco "Trocar minha senha" do modal de Configurações: o próprio usuário troca
// a senha, sem depender de um administrador no Boss Only.
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SENHA_TAMANHO_MINIMO, trocarMinhaSenha, type TrocaSenhaEntrada } from '../services/minhaSenhaService';

const VAZIO: TrocaSenhaEntrada = { senhaAtual: '', novaSenha: '', confirmacao: '' };

const CAMPOS: Array<{ campo: keyof TrocaSenhaEntrada; rotulo: string; autoComplete: string }> = [
  { campo: 'senhaAtual', rotulo: 'Senha atual', autoComplete: 'current-password' },
  { campo: 'novaSenha', rotulo: 'Nova senha', autoComplete: 'new-password' },
  { campo: 'confirmacao', rotulo: 'Confirmar nova senha', autoComplete: 'new-password' },
];

export function TrocarSenhaSecao({ email }: { email?: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<TrocaSenhaEntrada>(VAZIO);
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<{ texto: string; campo?: keyof TrocaSenhaEntrada } | null>(null);

  const fechar = () => {
    setAberto(false);
    setValores(VAZIO);
    setMostrar(false);
    setErro(null);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await trocarMinhaSenha(valores);
      if (resultado.ok) {
        toast.success('Senha trocada! Use a nova senha no próximo acesso.');
        fechar();
      } else {
        setErro({ texto: resultado.erro, campo: resultado.campo });
      }
    } catch {
      setErro({ texto: 'Não foi possível trocar a senha agora. Tente novamente em instantes.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <span className="font-medium text-gray-800 dark:text-gray-100">Trocar minha senha</span>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
            Escolha uma nova senha para entrar no Gerenciador. Você vai precisar da senha atual.
          </p>
        </div>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            <KeyRound className="w-4 h-4" aria-hidden />
            Trocar senha
          </button>
        )}
      </div>

      {aberto && (
        <form onSubmit={enviar} className="mt-4 space-y-3" noValidate>
          {/* Ajuda gerenciadores de senha do navegador a saber de qual conta é a senha. */}
          <input type="text" name="username" autoComplete="username" value={email ?? ''} readOnly hidden />

          {CAMPOS.map(({ campo, rotulo, autoComplete }) => {
            const id = `trocar-senha-${campo}`;
            const comErro = erro?.campo === campo;
            return (
              <div key={campo}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {rotulo}
                </label>
                <input
                  id={id}
                  type={mostrar ? 'text' : 'password'}
                  autoComplete={autoComplete}
                  value={valores[campo]}
                  onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
                  disabled={salvando}
                  aria-invalid={comErro || undefined}
                  aria-describedby={comErro ? 'trocar-senha-erro' : undefined}
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    comErro ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {campo === 'novaSenha' && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Pelo menos {SENHA_TAMANHO_MINIMO} caracteres.
                  </p>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setMostrar((m) => !m)}
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300 hover:underline"
          >
            {mostrar ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
            {mostrar ? 'Ocultar senhas' : 'Mostrar senhas'}
          </button>

          {erro && (
            <p id="trocar-senha-erro" role="alert" className="text-sm text-red-600 dark:text-red-400">
              {erro.texto}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={fechar}
              disabled={salvando}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {salvando ? 'Trocando...' : 'Salvar nova senha'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
