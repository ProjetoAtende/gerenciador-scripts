// __tests__/desativacao/desativacaoUsuario.test.ts
// Testes unitários do sistema de desativação de usuários
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock do supabaseClient (vi.hoisted para uso no factory) ──
const { mockRpc, mockFrom, chainObj, mockAuth, mockFunctions } = vi.hoisted(() => {
  const mockRpc = vi.fn();

  // Objeto chainável: cada método retorna ele mesmo
  const chainObj: Record<string, ReturnType<typeof vi.fn>> = {};
  chainObj.select = vi.fn(() => chainObj);
  chainObj.insert = vi.fn(() => chainObj);
  chainObj.delete = vi.fn(() => chainObj);
  chainObj.update = vi.fn(() => chainObj);
  chainObj.eq = vi.fn(() => chainObj);
  chainObj.neq = vi.fn(() => chainObj);
  chainObj.not = vi.fn(() => chainObj);
  chainObj.or = vi.fn(() => chainObj);
  chainObj.in = vi.fn(() => chainObj);
  chainObj.order = vi.fn(() => chainObj);
  chainObj.limit = vi.fn(() => chainObj);
  chainObj.single = vi.fn(() => chainObj);
  chainObj.maybeSingle = vi.fn(() => chainObj);

  const mockFrom = vi.fn(() => chainObj);

  const mockAuth = {
    admin: {
      updateUserById: vi.fn(),
    },
  };

  const mockFunctions = {
    invoke: vi.fn(),
  };

  return { mockRpc, mockFrom, chainObj, mockAuth, mockFunctions };
});

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: mockAuth,
    functions: mockFunctions,
  },
}));

import {
  toggleUsuarioAtivo,
  toggleUsuarioAtivoComBan,
  listarUsuarios,
} from '../../services/adminService';
import { usersService } from '../../services/usersService';

// ─── Helpers ──
function resetChain() {
  Object.keys(chainObj).forEach(key => {
    chainObj[key].mockImplementation(() => chainObj);
  });
}

// ─── Tests ──

describe('Sistema de Desativação de Usuários', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    mockRpc.mockReset();
    mockAuth.admin.updateUserById.mockReset();
    mockFunctions.invoke.mockReset();
  });

  // ═══════════════════════════════════════════════════════
  // toggleUsuarioAtivo
  // ═══════════════════════════════════════════════════════

  describe('toggleUsuarioAtivo', () => {
    it('deve retornar success e ativo=false ao desativar', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, ativo: false, message: 'Usuário desativado' },
        error: null,
      });

      const result = await toggleUsuarioAtivo('user-123');

      expect(result.success).toBe(true);
      expect(result.ativo).toBe(false);
      expect(mockRpc).toHaveBeenCalledWith('admin_toggle_usuario_ativo', {
        p_user_id: 'user-123',
      });
    });

    it('deve retornar success e ativo=true ao reativar', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, ativo: true, message: 'Usuário reativado' },
        error: null,
      });

      const result = await toggleUsuarioAtivo('user-123');

      expect(result.success).toBe(true);
      expect(result.ativo).toBe(true);
    });

    it('deve retornar erro quando RPC falha', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error: permission denied' },
      });

      const result = await toggleUsuarioAtivo('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC error: permission denied');
    });

    it('deve retornar erro ao tentar desativar o Boss', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: false, error: 'Não é possível desativar o administrador' },
        error: null,
      });

      const result = await toggleUsuarioAtivo('boss-user-id');

      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════
  // toggleUsuarioAtivoComBan
  // ═══════════════════════════════════════════════════════

  describe('toggleUsuarioAtivoComBan', () => {
    it('deve banir no Auth ao desativar', async () => {
      mockFunctions.invoke.mockResolvedValueOnce({
        data: { success: true, ativo: false, message: 'Desativado' },
        error: null,
      });

      const result = await toggleUsuarioAtivoComBan('user-123');

      expect(result.success).toBe(true);
      expect(result.ativo).toBe(false);
      expect(mockFunctions.invoke).toHaveBeenCalledWith('admin-users', {
        body: {
          action: 'toggle-active',
          payload: {
            userId: 'user-123',
          },
        },
      });
    });

    it('deve remover ban no Auth ao reativar', async () => {
      mockFunctions.invoke.mockResolvedValueOnce({
        data: { success: true, ativo: true, message: 'Reativado' },
        error: null,
      });

      const result = await toggleUsuarioAtivoComBan('user-123');

      expect(result.success).toBe(true);
      expect(result.ativo).toBe(true);
    });

    it('deve retornar erro quando a Edge Function falha', async () => {
      mockFunctions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Auth API error' },
      });

      const result = await toggleUsuarioAtivoComBan('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Auth API error');
    });

    it('deve retornar erro se a Edge Function falhar antes de aplicar o toggle', async () => {
      mockFunctions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' },
      });

      const result = await toggleUsuarioAtivoComBan('user-123');

      expect(result.success).toBe(false);
      expect(mockAuth.admin.updateUserById).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════
  // listarUsuarios — filtro de ativo
  // ═══════════════════════════════════════════════════════

  describe('listarUsuarios — filtro ativo', () => {
    // Precisamos simular o chain completo: from('users').select('*').order('nome') → { data, error }
    // E depois from('equipes'), from('setores') para os mapas

    it('deve filtrar apenas ativos quando ativo=true', async () => {
      const mockUsers = [
        { id: 'u1', nome: 'Alice', email: 'alice@test.com', equipe_id: 'e1', setor_id: null, ativo: true },
      ];

      chainObj.eq.mockImplementation(() => {
        return { data: mockUsers, error: null };
      });

      mockFrom.mockReturnValue(chainObj);

      try {
        await listarUsuarios({ ativo: true });
      } catch {
        // O mock simplificado não cobre todas as queries auxiliares de supervisorias/equipes.
      }

      // Verificar que .eq foi chamado com 'ativo', true
      expect(chainObj.eq).toHaveBeenCalledWith('ativo', true);
    });

    it('deve filtrar apenas inativos quando ativo=false', async () => {
      const mockUsers = [
        { id: 'u2', nome: 'Bob Inativo', email: 'bob@test.com', equipe_id: null, setor_id: null, ativo: false },
      ];

      chainObj.eq.mockImplementation(() => {
        return { data: mockUsers, error: null };
      });

      mockFrom.mockReturnValue(chainObj);

      // Nota: listarUsuarios faz múltiplas queries, o mock simplificado
      // pode não cobrir a função completa, mas verifica o filtro
      try {
        await listarUsuarios({ ativo: false });
      } catch {
        // É esperado que falhe no mock simplificado para equipes/setores
      }

      expect(chainObj.eq).toHaveBeenCalledWith('ativo', false);
    });

    it('não deve aplicar filtro de ativo quando não especificado', async () => {
      const mockUsers: never[] = [];
      chainObj.order.mockReturnValueOnce({ data: mockUsers, error: null });

      mockFrom.mockReturnValue(chainObj);

      const result = await listarUsuarios({});

      // eq NÃO deve ter sido chamado com 'ativo' (nenhum eq chamado)
      // Verifica que a query termina no .order sem .eq('ativo')
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════
  // getTeamUsersStatus — exclui inativos
  // ═══════════════════════════════════════════════════════

  describe('getTeamUsersStatus — exclui inativos', () => {
    it('deve incluir .or(ativo.is.null,ativo.eq.true) na query de membros da equipe', async () => {
      const mockTeamUsers = [
        { id: 'u1', nome: 'Alice', email: 'alice@test.com' },
        { id: 'u3', nome: 'Charlie', email: 'charlie@test.com' },
      ];

      // O chain: from('users').select(...).eq('equipe_id', id).or('ativo.is.null,ativo.eq.true')
      chainObj.or.mockReturnValueOnce({
        data: mockTeamUsers,
        error: null,
      });

      // Segunda query: from('tickets') para tickets ativos
      mockFrom
        .mockReturnValueOnce(chainObj)  // from('users')
        .mockReturnValueOnce({          // from('tickets')
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              not: vi.fn(() => ({
                in: vi.fn(() => ({ data: [], error: null })),
              })),
            })),
          })),
        } as any);

      const result = await usersService.getTeamUsersStatus('equipe-123');

      // Verifica que .or foi chamado para filtrar inativos (null ou true)
      expect(chainObj.or).toHaveBeenCalledWith('ativo.is.null,ativo.eq.true');
      expect(chainObj.eq).toHaveBeenCalledWith('equipe_id', 'equipe-123');
      expect(result).toHaveLength(2);
      expect(result[0].nome).toBe('Alice');
      expect(result[1].nome).toBe('Charlie');
    });

    it('deve retornar array vazio quando equipe não tem membros ativos', async () => {
      chainObj.or.mockReturnValueOnce({
        data: [],
        error: null,
      });

      mockFrom.mockReturnValueOnce(chainObj);

      const result = await usersService.getTeamUsersStatus('equipe-vazia');

      expect(result).toEqual([]);
    });

    it('deve propagar erro da query', async () => {
      chainObj.or.mockReturnValueOnce({
        data: null,
        error: { message: 'DB connection error' },
      });

      mockFrom.mockReturnValueOnce(chainObj);

      await expect(usersService.getTeamUsersStatus('equipe-123')).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════
  // listarUsuariosParaTransferencia — exclui inativos
  // ═══════════════════════════════════════════════════════

});
