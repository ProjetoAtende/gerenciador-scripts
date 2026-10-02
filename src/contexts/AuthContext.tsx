// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";

export type GerenciadorUserRole = 'user' | 'supervisor' | 'coordenador' | 'admin';

/** Supervisor, coordenador ou admin — acima do perfil operacional `user`. */
export function podeGerenciarTiposServico(role: GerenciadorUserRole | null | undefined): boolean {
  return role === 'supervisor' || role === 'coordenador' || role === 'admin';
}

interface AuthContextType {
  user: User | null;
  currentUser: User | null; // Alias para compatibilidade
  loading: boolean;
  equipeId: string | null;
  userRole: GerenciadorUserRole | null;
  setEquipeId: (id: string | null) => void;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const normalizeGerenciadorRole = (role: string | null | undefined): GerenciadorUserRole => {
  if (role === 'admin' || role === 'supervisor' || role === 'coordenador' || role === 'user') {
    return role;
  }

  return 'user';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipeId, setEquipeId] = useState<string | null>(localStorage.getItem("equipeId"));
  const [userRole, setUserRole] = useState<GerenciadorUserRole | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let initialSessionHandled = false;

    const applySession = (session: { user: User | null } | null) => {
      if (!isMounted) return;

      initialSessionHandled = true;
      setUser(session?.user ?? null);
      setLoading(false);

      if (!session) {
        setUserRole(null);
        setEquipeId(null);
        setIsLoggingOut(false);
        localStorage.removeItem("equipeId");
      }
    };

    // Escuta mudanças de autenticação
    // IMPORTANTE: o callback NÃO pode ser async nem fazer queries Supabase.
    // Em auth-js v2.69.1, _emitInitialSession aguarda (await) o callback
    // enquanto segura o lock interno. Se o callback fizer supabase.from(...)
    // isso chama getSession() que precisa do mesmo lock → DEADLOCK permanente
    // que trava TODAS as queries subsequentes.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);

      // Guard: verificar se o usuário está ativo (fora do callback síncrono)
      if (session?.user) {
        setTimeout(async () => {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('ativo, role')
              .eq('id', session.user.id)
              .single();

            // Setar role do usuário
            setUserRole(normalizeGerenciadorRole(userData?.role));

            if (userData?.ativo === false) {
              await supabase.auth.signOut();
              setUser(null);
              setUserRole(null);
              setEquipeId(null);
              localStorage.removeItem('equipeId');
              alert('Sua conta foi desativada. Entre em contato com o administrador.');
            }
          } catch (err) {
            // Falha silenciosa na verificação de ativo - não impede o uso
            console.warn('Erro ao verificar status ativo do usuário:', err);
          }
        }, 0);
      }
    });

    const fallbackTimer = window.setTimeout(async () => {
      if (initialSessionHandled || !isMounted) return;

      try {
        const { data } = await supabase.auth.getSession();
        applySession(data.session);
      } catch {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 1500);

    return () => {
      isMounted = false;
      window.clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const atualizarEquipeId = (id: string | null) => {
    if (id) {
      localStorage.setItem("equipeId", id);
    } else {
      localStorage.removeItem("equipeId");
    }
    setEquipeId(id);
  };

  const logout = async () => {
    if (isLoggingOut) return; // Prevenir múltiplos cliques
    
    setIsLoggingOut(true);
    
    try {
      // Desconectar da presença antes do logout (marca como offline)
      if (typeof window !== 'undefined' && (window as any).disconnectPresence) {
        await (window as any).disconnectPresence();
      }

      await supabase.auth.signOut();
      
      setUser(null);
      setUserRole(null);
      setEquipeId(null);
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirecionar para raiz (HashRouter)
      // Usar hash para compatibilidade com HashRouter/Pages (evita navegar para domínio raiz)
      if (typeof window !== 'undefined') {
        window.location.hash = '/';
      }
    } catch (error) {
      // Erro silencioso - apenas resetar estado
      setIsLoggingOut(false);
      // Forçar redirecionamento via hash mesmo com erro (mantém host/path atuais)
      if (typeof window !== 'undefined') {
        window.location.hash = '/';
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      currentUser: user, // Alias para compatibilidade
      loading, 
      equipeId, 
      userRole,
      setEquipeId: atualizarEquipeId, 
      logout,
      isLoggingOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
};
