// src/pages/LoginPage.tsx
import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { setEquipeId } = useAuth(); // ✅ acesso ao contexto
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async () => {
    // Validações básicas
    if (!email || !senha) {
      toast.error("Por favor, preencha email e senha");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);

    if (error) {
      // Mensagens amigáveis sem informações técnicas
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('invalid') || errorMsg.includes('credentials')) {
        toast.error("Email ou senha incorretos");
      } else if (errorMsg.includes('email') && errorMsg.includes('confirm')) {
        toast.error("Email não confirmado. Entre em contato com o administrador");
      } else if (errorMsg.includes('not found')) {
        toast.error("Usuário não encontrado");
      } else {
        // Sempre mostrar uma mensagem amigável
        toast.error("Não foi possível realizar o login. Verifique suas credenciais");
      }
    } else {
      setEquipeId(null);
      toast.success("Login realizado com sucesso!");
    }
  };

  // Permitir login com Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !carregando) {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-md w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4 text-center dark:text-gray-100">
          Entrar
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full border dark:border-gray-600 p-2 rounded mb-2 dark:bg-gray-700 dark:text-gray-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyPress={handleKeyPress}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Senha"
          className="w-full border dark:border-gray-600 p-2 rounded mb-4 dark:bg-gray-700 dark:text-gray-100"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyPress={handleKeyPress}
          autoComplete="current-password"
        />

        <button
          onClick={handleSubmit}
          disabled={carregando}
          className={`w-full p-2 rounded text-white ${
            carregando ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>

      </div>
    </div>
  );
}
