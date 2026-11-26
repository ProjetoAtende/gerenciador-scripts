import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({ supabase: { auth } }));

import { trocarMinhaSenha, validarTrocaSenha } from './minhaSenhaService';

const ENTRADA = { senhaAtual: 'antiga1', novaSenha: 'nova-senha', confirmacao: 'nova-senha' };

describe('validarTrocaSenha', () => {
  it('aceita uma troca correta', () => {
    expect(validarTrocaSenha(ENTRADA)).toBeNull();
  });

  it('exige a senha atual', () => {
    expect(validarTrocaSenha({ ...ENTRADA, senhaAtual: '' })?.campo).toBe('senhaAtual');
  });

  it('exige pelo menos 6 caracteres', () => {
    expect(validarTrocaSenha({ ...ENTRADA, novaSenha: '12345', confirmacao: '12345' })?.campo).toBe('novaSenha');
    expect(validarTrocaSenha({ ...ENTRADA, novaSenha: '123456', confirmacao: '123456' })).toBeNull();
  });

  it('recusa nova senha igual à atual', () => {
    expect(validarTrocaSenha({ senhaAtual: 'mesma123', novaSenha: 'mesma123', confirmacao: 'mesma123' })?.campo).toBe('novaSenha');
  });

  it('recusa confirmação diferente', () => {
    expect(validarTrocaSenha({ ...ENTRADA, confirmacao: 'outra-coisa' })?.campo).toBe('confirmacao');
  });
});

describe('trocarMinhaSenha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'fulana@example.com' } } } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
  });

  it('confere a senha atual e só então grava a nova', async () => {
    expect(await trocarMinhaSenha(ENTRADA)).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'fulana@example.com', password: 'antiga1' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nova-senha' });
    expect(auth.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0]);
  });

  it('não troca se a senha atual estiver errada', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
    const r = await trocarMinhaSenha(ENTRADA);
    expect(r).toMatchObject({ ok: false, campo: 'senhaAtual', erro: 'A senha atual não está correta.' });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('não chama o servidor quando a validação local falha', async () => {
    const r = await trocarMinhaSenha({ ...ENTRADA, confirmacao: 'x' });
    expect(r.ok).toBe(false);
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('avisa quando a sessão expirou', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const r = await trocarMinhaSenha(ENTRADA);
    expect(r).toMatchObject({ ok: false });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('traduz senha fraca recusada pelo servidor', async () => {
    auth.updateUser.mockResolvedValue({ error: { message: 'Password is known to be weak', code: 'weak_password' } });
    const r = await trocarMinhaSenha(ENTRADA);
    expect(r).toMatchObject({ ok: false, campo: 'novaSenha' });
    if (!r.ok) expect(r.erro).toContain('fraca');
  });

  it('traduz excesso de tentativas', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Request rate limit reached', status: 429 } });
    const r = await trocarMinhaSenha(ENTRADA);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.erro).toContain('Muitas tentativas');
  });
});
