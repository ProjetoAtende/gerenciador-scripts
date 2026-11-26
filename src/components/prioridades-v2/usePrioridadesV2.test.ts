import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Quando a aba volta a ficar visível, o Supabase reemite o login com um objeto `user`
// NOVO (mesmo ID). A v2 não pode recarregar por isso: a Nova Anotação perdia o que
// estava sendo preenchido.

const auth = vi.hoisted(() => ({ user: { id: 'u1', email: 'a@example.com' } as { id: string; email: string } }));
const servicos = vi.hoisted(() => ({
  obterMeuPerfil: vi.fn(async () => ({ perfil: null, perfilEfetivo: null, modulo: null })),
  listarUpjs: vi.fn(async () => []),
  listarLinhasPainel: vi.fn(async () => []),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../services/prioridadesService', () => servicos);
vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nome: 'Fulana' } }) }) }) }),
  },
}));

import { usePrioridadesV2 } from './usePrioridadesV2';

describe('usePrioridadesV2 — troca de aba', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    auth.user = { id: 'u1', email: 'a@example.com' };
  });

  it('não recarrega quando o Supabase entrega outro objeto do mesmo usuário', async () => {
    const { result, rerender } = renderHook(() => usePrioridadesV2(true));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(servicos.obterMeuPerfil).toHaveBeenCalledTimes(1);

    act(() => result.current.irPara({ tipo: 'nova' }));
    auth.user = { id: 'u1', email: 'a@example.com' }; // objeto novo, mesmo ID
    rerender();

    expect(result.current.carregando).toBe(false);
    expect(result.current.tela).toEqual({ tipo: 'nova' });
    expect(servicos.obterMeuPerfil).toHaveBeenCalledTimes(1);
  });

  it('recarrega quando é outro usuário', async () => {
    const { result, rerender } = renderHook(() => usePrioridadesV2(true));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    auth.user = { id: 'u2', email: 'b@example.com' };
    rerender();

    await waitFor(() => expect(servicos.obterMeuPerfil).toHaveBeenCalledTimes(2));
  });
});
