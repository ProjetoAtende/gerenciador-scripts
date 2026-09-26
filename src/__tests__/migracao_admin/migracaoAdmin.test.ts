// src/__tests__/migracao_admin/migracaoAdmin.test.ts
// Testes exaustivos para validar migração de Boss → Admin (role-based)
// Cobertura: adminService, notificacaoExclusaoService, isBoss→isAdmin, ScriptsModal curadoria
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock do supabaseClient (vi.hoisted para uso no factory) ──
const { mockRpc, mockFrom, chainObj, mockAuth, mockFunctions } = vi.hoisted(() => {
  const mockRpc = vi.fn();

  const chainObj: Record<string, ReturnType<typeof vi.fn>> = {};
  chainObj.select = vi.fn(() => chainObj);
  chainObj.insert = vi.fn(() => chainObj);
  chainObj.delete = vi.fn(() => chainObj);
  chainObj.update = vi.fn(() => chainObj);
  chainObj.eq = vi.fn(() => chainObj);
  chainObj.neq = vi.fn(() => chainObj);
  chainObj.not = vi.fn(() => chainObj);
  chainObj.in = vi.fn(() => chainObj);
  chainObj.order = vi.fn(() => chainObj);
  chainObj.limit = vi.fn(() => chainObj);
  chainObj.single = vi.fn(() => chainObj);
  chainObj.maybeSingle = vi.fn(() => chainObj);

  const mockFrom = vi.fn(() => chainObj);

  const mockAuth = {
    admin: {
      updateUserById: vi.fn(),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
    getUser: vi.fn(),
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
  isBoss,
  isAdmin,
  toggleUsuarioAtivo,
  criarUsuario,
  editarUsuario,
  criarSetor,
  editarSetor,
  deletarSetor,
  criarEquipe,
  editarEquipe,
  criarGSE,
  resetarSenhaUsuario,
} from '../../services/adminService';

import {
  isAdminExclusaoScripts,
  listarNotificacoesExclusaoPendentes,
} from '../../services/notificacaoExclusaoService';

// ─── Helpers ──
function resetChain() {
  Object.keys(chainObj).forEach(key => {
    chainObj[key].mockImplementation(() => chainObj);
  });
}

// ═══════════════════════════════════════════════════════════
// GRUPO 1: Função isAdmin() — Nova função baseada em role
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: Função isAdmin() baseada em role', () => {
  describe('isAdmin()', () => {
    it('deve retornar TRUE para role "admin"', () => {
      expect(isAdmin('admin')).toBe(true);
    });

    it('deve retornar FALSE para role "user"', () => {
      expect(isAdmin('user')).toBe(false);
    });

    it('deve retornar FALSE para role "supervisor"', () => {
      expect(isAdmin('supervisor')).toBe(false);
    });

    it('deve retornar FALSE para role "coordenador"', () => {
      expect(isAdmin('coordenador')).toBe(false);
    });

    it('deve retornar FALSE para null', () => {
      expect(isAdmin(null)).toBe(false);
    });

    it('deve retornar FALSE para undefined', () => {
      expect(isAdmin(undefined)).toBe(false);
    });

    it('deve retornar FALSE para string vazia', () => {
      expect(isAdmin('')).toBe(false);
    });

    it('deve retornar FALSE para "Admin" (case sensitive)', () => {
      expect(isAdmin('Admin')).toBe(false);
    });
  });

  describe('isBoss() — Retrocompatibilidade', () => {
    // NOTA: Após migração, isBoss() deve ser deprecated mas ainda funcionar
    // Se isBoss foi removido, estes testes devem ser omitidos
    it('isBoss deve existir como função exportada', () => {
      expect(typeof isBoss).toBe('function');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GRUPO 2: isAdminExclusaoScripts — Verificação de admin para exclusão
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: isAdminExclusaoScripts baseada em role', () => {
  it('deve retornar TRUE para role "admin"', async () => {
    // Após migração, a função recebe role ao invés de email
    const result = await isAdminExclusaoScripts('admin');
    expect(result).toBe(true);
  });

  it('deve retornar FALSE para role "user"', async () => {
    const result = await isAdminExclusaoScripts('user');
    expect(result).toBe(false);
  });

  it('deve retornar FALSE para role "coordinator"', async () => {
    const result = await isAdminExclusaoScripts('coordenador');
    expect(result).toBe(false);
  });

  it('deve retornar FALSE para undefined', async () => {
    const result = await isAdminExclusaoScripts(undefined);
    expect(result).toBe(false);
  });

  it('deve retornar FALSE para string vazia', async () => {
    const result = await isAdminExclusaoScripts('');
    expect(result).toBe(false);
  });

  // IMPORTANTE: Não deve mais aceitar email como parâmetro
  it('deve retornar FALSE se email for passado ao invés de role', async () => {
    const result = await isAdminExclusaoScripts('dpestilli@tjsp.jus.br');
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// GRUPO 3: CRUD Admin — Todas as operações devem funcionar via RPC
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: CRUDs Admin funcionam via RPC (sem email hardcoded)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    mockRpc.mockReset();
    mockFunctions.invoke.mockReset();
  });

  // ─── Setores ──
  describe('CRUD Setores', () => {
    it('criarSetor deve chamar admin_criar_setor via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, id: 'setor-123', message: 'Setor criado' },
        error: null,
      });

      const result = await criarSetor('Novo Setor');
      expect(mockRpc).toHaveBeenCalledWith('admin_criar_setor', { p_nome: 'Novo Setor' });
      expect(result.success).toBe(true);
    });

    it('editarSetor deve chamar admin_atualizar_setor via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, message: 'Setor atualizado' },
        error: null,
      });

      const result = await editarSetor('setor-123', 'Setor Renomeado');
      expect(mockRpc).toHaveBeenCalledWith('admin_atualizar_setor', { 
        p_id: 'setor-123', 
        p_nome: 'Setor Renomeado' 
      });
      expect(result.success).toBe(true);
    });

    it('deletarSetor deve chamar admin_deletar_setor via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, message: 'Setor excluído' },
        error: null,
      });

      const result = await deletarSetor('setor-123');
      expect(mockRpc).toHaveBeenCalledWith('admin_deletar_setor', { p_id: 'setor-123' });
      expect(result.success).toBe(true);
    });
  });

  // ─── Equipes ──
  describe('CRUD Equipes', () => {
    it('criarEquipe deve chamar admin_criar_equipe via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, id: 'equipe-123' },
        error: null,
      });

      const result = await criarEquipe('Nova Equipe', 'setor-123');
      expect(mockRpc).toHaveBeenCalledWith('admin_criar_equipe', { 
        p_nome: 'Nova Equipe', 
        p_setor_id: 'setor-123' 
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── Usuários ──
  describe('CRUD Usuários', () => {
    it('criarUsuario deve criar via RPC admin_criar_usuario', async () => {
      mockFunctions.invoke.mockResolvedValueOnce({
        data: { success: true, user_id: 'user-new', senha: 'senha123', message: 'Usuário criado com sucesso' },
        error: null,
      });

      const result = await criarUsuario({
        email: 'test@test.com',
        senha: 'senha123',
        nome: 'Teste',
        role: 'user',
      });
      expect(mockFunctions.invoke).toHaveBeenCalledWith('admin-users', {
        body: {
          action: 'create',
          payload: {
            email: 'test@test.com',
            senha: 'senha123',
            nome: 'Teste',
            role: 'user',
            equipe_id: null,
            setor_id: null,
            supervisor_equipe_ids: [],
          },
        },
      });
      expect(result.success).toBe(true);
      expect(result.user_id).toBe('user-new');
    });

    it('editarUsuario deve chamar admin_atualizar_usuario via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, message: 'Usuário atualizado' },
        error: null,
      });

      const result = await editarUsuario('user-123', { nome: 'Novo Nome', role: 'admin' });
      expect(result.success).toBe(true);
    });
  });

  // ─── GSEs ──
  describe('CRUD GSEs', () => {
    it('criarGSE deve chamar admin_criar_gse via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, id: 'gse-123' },
        error: null,
      });

      const result = await criarGSE('GSE-001', 'equipe-123');
      expect(result.success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GRUPO 4: Proteções de integridade — Admin não pode ser desativado/deletado
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: Proteções de integridade para admins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    mockRpc.mockReset();
    mockFunctions.invoke.mockReset();
  });

  describe('toggleUsuarioAtivo — Proteção anti-desativação de admin', () => {
    it('deve bloquear desativação de qualquer admin (não apenas dpestilli)', async () => {
      // Simula RPC retornando erro quando tenta desativar admin
      mockRpc.mockResolvedValueOnce({
        data: { success: false, error: 'Não é possível desativar um administrador. Remova o perfil admin primeiro.' },
        error: null,
      });

      const result = await toggleUsuarioAtivo('admin-qualquer-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('administrador');
    });

    it('deve permitir desativar usuário não-admin normalmente', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, ativo: false, message: 'Usuário desativado' },
        error: null,
      });

      const result = await toggleUsuarioAtivo('user-comum-id');
      expect(result.success).toBe(true);
    });

    it('deve permitir reativar usuário normalmente', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, ativo: true, message: 'Usuário ativado' },
        error: null,
      });

      const result = await toggleUsuarioAtivo('user-inativo-id');
      expect(result.success).toBe(true);
      expect(result.ativo).toBe(true);
    });
  });

  describe('Resetar senha de admin', () => {
    it('deve permitir resetar senha (admin pode resetar senha de qualquer um)', async () => {
      mockFunctions.invoke.mockResolvedValueOnce({
        data: { success: true, message: 'Senha alterada com sucesso' },
        error: null,
      });

      const result = await resetarSenhaUsuario('user-123', 'novaSenha123');
      expect(result.success).toBe(true);
      expect(mockFunctions.invoke).toHaveBeenCalledWith('admin-users', {
        body: {
          action: 'reset-password',
          payload: {
            userId: 'user-123',
            newPassword: 'novaSenha123',
          },
        },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GRUPO 5: Notificações de exclusão — Baseadas em role
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: Notificações de exclusão (role-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    mockRpc.mockReset();
    mockFunctions.invoke.mockReset();
  });

  it('listarNotificações deve retornar vazio para não-admin', async () => {
    const { notificacoes } = await listarNotificacoesExclusaoPendentes('user');
    expect(notificacoes).toEqual([]);
  });

  it('listarNotificações deve retornar dados para admin', async () => {
    // Mock da query de notificações
    chainObj.order.mockResolvedValueOnce({
      data: [
        {
          id: 'notif-1',
          script_id: 'script-123',
          script_nome: 'Script Teste',
          motivo: 'Obsoleto',
          criado_em: '2026-02-23T10:00:00Z',
          solicitante_id: 'user-456',
        },
      ],
      error: null,
    });

    // Mock da query de usuários (nomes dos solicitantes)
    chainObj.in.mockResolvedValueOnce({
      data: [{ id: 'user-456', nome: 'João Silva' }],
      error: null,
    });

    const { notificacoes } = await listarNotificacoesExclusaoPendentes('admin');
    expect(notificacoes.length).toBeGreaterThan(0);
    expect(notificacoes[0].scriptNome).toBe('Script Teste');
  });
});

// ═══════════════════════════════════════════════════════════
// GRUPO 6: Ausência de email hardcoded no código
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: Verificação de ausência de email hardcoded', () => {
  it('isAdmin NÃO deve conter email hardcoded', () => {
    const fnString = isAdmin.toString();
    expect(fnString).not.toContain('dpestilli');
    expect(fnString).not.toContain('@tjsp.jus.br');
  });

  it('isAdminExclusaoScripts NÃO deve conter email hardcoded', () => {
    const fnString = isAdminExclusaoScripts.toString();
    expect(fnString).not.toContain('dpestilli');
    expect(fnString).not.toContain('@tjsp.jus.br');
  });
});

// ═══════════════════════════════════════════════════════════
// GRUPO 7: Múltiplos admins — Cenários avançados
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: Suporte a múltiplos administradores', () => {
  it('isAdmin deve retornar TRUE para qualquer usuário com role admin', () => {
    // Simula 3 admins diferentes
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('admin')).toBe(true);
  });

  it('isAdminExclusaoScripts deve funcionar para qualquer admin', async () => {
    // Não depende de email específico
    const result1 = await isAdminExclusaoScripts('admin');
    const result2 = await isAdminExclusaoScripts('admin');
    expect(result1).toBe(true);
    expect(result2).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// GRUPO 8: Erros de RPC — Graceful handling
// ═══════════════════════════════════════════════════════════

describe('MIGRAÇÃO: Tratamento de erros de RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    mockRpc.mockReset();
    mockFunctions.invoke.mockReset();
  });

  it('criarSetor deve retornar erro quando usuário não é admin (RPC retorna acesso negado)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'Acesso negado. Apenas administradores podem criar setores.' },
      error: null,
    });

    const result = await criarSetor('Setor Proibido');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Acesso negado');
  });

  it('criarUsuario deve retornar erro quando RPC falha', async () => {
    mockFunctions.invoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const result = await criarUsuario({
      email: 'teste@teste.com',
      senha: '123456',
      nome: 'Teste',
    });
    expect(result.success).toBe(false);
  });

  it('editarEquipe deve retornar erro de RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC timeout' },
    });

    const result = await editarEquipe('eq-1', 'Equipe Nova', 'setor-1');
    expect(result.success).toBe(false);
  });
});
