import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useSimulation } from './SimulationContext';

interface PermissoesContextValue {
  loading: boolean;
  /** Conjunto de códigos liberados. Se contém '*' o usuário é admin (tudo liberado). */
  codigos: Set<string>;
  isAdmin: boolean;
  /** Verifica se o usuário possui permissão para o objeto informado. */
  temPermissao: (codigo: string) => boolean;
  /** Recarrega os grants (útil após salvar mudanças no modal de admin). */
  refresh: () => Promise<void>;
}

const PermissoesContext = createContext<PermissoesContextValue | undefined>(undefined);

export const PermissoesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { canSimulate, isSimulating, effectiveEquipeId, effectiveRole } = useSimulation();
  const [codigos, setCodigos] = useState<Set<string>>(new Set());
  const [grants, setGrants] = useState<Array<{ objeto_codigo: string; target_type: 'equipe' | 'role' | 'usuario'; target_id: string }>>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) {
      setCodigos(new Set());
      setGrants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: codigosData, error: codigosError }, { data: grantsData, error: grantsError }] = await Promise.all([
        supabase.rpc('permissoes_minhas_codigos'),
        supabase.from('permissoes_grants').select('objeto_codigo, target_type, target_id'),
      ]);

      if (codigosError) throw codigosError;
      if (grantsError) throw grantsError;

      setCodigos(new Set<string>((codigosData || []).map((r: any) => r.codigo)));
      setGrants((grantsData || []) as Array<{ objeto_codigo: string; target_type: 'equipe' | 'role' | 'usuario'; target_id: string }>);
    } catch (err) {
      console.error('[PermissoesProvider] erro ao carregar', err);
      setCodigos(new Set());
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const value = useMemo<PermissoesContextValue>(() => {
    const actualIsAdmin = codigos.has('*');
    const simulationAdmin = effectiveRole === 'admin';
    const simulatedCodes = new Set<string>();

    if (canSimulate && isSimulating) {
      for (const grant of grants) {
        if (grant.target_type === 'role' && effectiveRole && grant.target_id === effectiveRole) {
          simulatedCodes.add(grant.objeto_codigo);
        }
        if (grant.target_type === 'equipe' && effectiveEquipeId && grant.target_id === effectiveEquipeId) {
          simulatedCodes.add(grant.objeto_codigo);
        }
      }
    }

      return {
        loading,
        codigos: canSimulate && isSimulating ? simulatedCodes : codigos,
        isAdmin: canSimulate && isSimulating ? simulationAdmin : actualIsAdmin,
        temPermissao: (codigo: string) => {
          if (canSimulate && isSimulating) {
            return simulationAdmin || simulatedCodes.has(codigo);
          }
        return actualIsAdmin || codigos.has(codigo);
        },
        refresh: carregar,
      };
  }, [canSimulate, codigos, effectiveEquipeId, effectiveRole, grants, isSimulating, loading, carregar]);

  return (
    <PermissoesContext.Provider value={value}>{children}</PermissoesContext.Provider>
  );
};

export function usePermissoes(): PermissoesContextValue {
  const ctx = useContext(PermissoesContext);
  if (!ctx) throw new Error('usePermissoes deve ser usado dentro de PermissoesProvider');
  return ctx;
}

/** Hook conveniente para um único código. */
export function usePermissao(codigo: string): boolean {
  return usePermissoes().temPermissao(codigo);
}
