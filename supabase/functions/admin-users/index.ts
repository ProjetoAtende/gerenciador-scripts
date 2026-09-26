import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type UserRole = 'user' | 'supervisor' | 'coordenador' | 'admin';
type AdminAction = 'create' | 'toggle-active' | 'reset-password';

type AdminPayload = {
  action?: AdminAction;
  payload?: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

const json = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeOptionalUuid = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized === '' ? null : normalized;
};

const normalizeSupervisorEquipeIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => normalizeText(item))
      .filter((item) => item !== '')
  )];
};

const mapRole = (value: unknown): UserRole => {
  const role = normalizeText(value).toLowerCase();

  if (role === 'admin' || role === 'supervisor' || role === 'coordenador') {
    return role;
  }

  return 'user';
};

const isAdminActor = async (adminClient: ReturnType<typeof createClient>, userId: string) => {
  const { data, error } = await adminClient
    .from('users')
    .select('id, role, ativo, email')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: `Falha ao validar usuário administrador: ${error.message}` };
  }

  if (!data || data.ativo === false || data.role !== 'admin') {
    return { ok: false, status: 403, error: 'Acesso negado. Apenas administradores podem executar esta ação.' };
  }

  return { ok: true, actor: data };
};

const validateSetorEquipe = async (
  adminClient: ReturnType<typeof createClient>,
  setorId: string | null,
  equipeId: string | null
) => {
  let resolvedSetorId = setorId;

  if (equipeId) {
    const { data: equipe, error } = await adminClient
      .from('equipes')
      .select('id, setor_id')
      .eq('id', equipeId)
      .maybeSingle();

    if (error) {
      return { ok: false, status: 500, error: `Falha ao validar equipe: ${error.message}` };
    }

    if (!equipe) {
      return { ok: false, status: 400, error: 'Equipe inválida.' };
    }

    if (!resolvedSetorId) {
      resolvedSetorId = equipe.setor_id;
    } else if (resolvedSetorId !== equipe.setor_id) {
      return { ok: false, status: 400, error: 'A equipe informada não pertence ao setor selecionado.' };
    }
  }

  if (resolvedSetorId) {
    const { data: setor, error } = await adminClient
      .from('setores')
      .select('id')
      .eq('id', resolvedSetorId)
      .maybeSingle();

    if (error) {
      return { ok: false, status: 500, error: `Falha ao validar setor: ${error.message}` };
    }

    if (!setor) {
      return { ok: false, status: 400, error: 'Setor inválido.' };
    }
  }

  return { ok: true, setorId: resolvedSetorId };
};

const syncSupervisorias = async (
  adminClient: ReturnType<typeof createClient>,
  actorId: string,
  userId: string,
  role: UserRole,
  supervisorEquipeIds: string[]
) => {
  if (supervisorEquipeIds.length > 0 && role !== 'admin' && role !== 'supervisor') {
    return { ok: false, status: 400, error: 'Supervisorias adicionais só podem ser atribuídas a admins ou supervisores.' };
  }

  if (supervisorEquipeIds.length === 0) {
    return { ok: true };
  }

  const { data: equipes, error: equipesError } = await adminClient
    .from('equipes')
    .select('id')
    .in('id', supervisorEquipeIds);

  if (equipesError) {
    return { ok: false, status: 500, error: `Falha ao validar supervisorias: ${equipesError.message}` };
  }

  if ((equipes || []).length !== supervisorEquipeIds.length) {
    return { ok: false, status: 400, error: 'Uma ou mais equipes de supervisão são inválidas.' };
  }

  const rows = supervisorEquipeIds.map((equipeId) => ({
    user_id: userId,
    equipe_id: equipeId,
    funcao: 'supervisor',
    ativo: true,
    criado_por: actorId,
  }));

  const { error } = await adminClient
    .from('usuario_funcoes_equipe')
    .upsert(rows, { onConflict: 'user_id,equipe_id,funcao' });

  if (error) {
    return { ok: false, status: 500, error: `Falha ao salvar supervisorias: ${error.message}` };
  }

  return { ok: true };
};

const rollbackCreatedUser = async (
  adminClient: ReturnType<typeof createClient>,
  userId: string
) => {
  await adminClient
    .from('usuario_funcoes_equipe')
    .delete()
    .eq('user_id', userId)
    .eq('funcao', 'supervisor');

  await adminClient
    .from('users')
    .delete()
    .eq('id', userId);

  await adminClient.auth.admin.deleteUser(userId);
};

const handleCreateUser = async (
  adminClient: ReturnType<typeof createClient>,
  actorId: string,
  payload: Record<string, unknown>,
) => {
  const email = normalizeText(payload.email).toLowerCase();
  const senha = normalizeText(payload.senha);
  const nome = normalizeText(payload.nome);
  const role = mapRole(payload.role);
  const equipeId = normalizeOptionalUuid(payload.equipe_id);
  const setorId = normalizeOptionalUuid(payload.setor_id);
  const supervisorEquipeIds = normalizeSupervisorEquipeIds(payload.supervisor_equipe_ids);

  if (!email) return json({ success: false, error: 'Email é obrigatório.' }, 400);
  if (senha.length < 6) return json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres.' }, 400);
  if (!nome) return json({ success: false, error: 'Nome é obrigatório.' }, 400);

  const existingUser = await adminClient
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser.error) {
    return json({ success: false, error: `Falha ao validar email existente: ${existingUser.error.message}` }, 500);
  }

  if (existingUser.data) {
    return json({ success: false, error: 'Email já cadastrado no sistema.' }, 409);
  }

  const validatedScope = await validateSetorEquipe(adminClient, setorId, equipeId);
  if (!validatedScope.ok) {
    return json({ success: false, error: validatedScope.error }, validatedScope.status);
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      nome,
      role,
      app_context: 'gerenciador',
    },
  });

  if (authError || !authData.user?.id) {
    return json({
      success: false,
      error: authError?.message || 'Falha ao criar usuário no Auth.',
    }, 502);
  }

  const userId = authData.user.id;

  const { error: upsertError } = await adminClient
    .from('users')
    .upsert({
      id: userId,
      email,
      nome,
      role,
      equipe_id: equipeId,
      setor_id: validatedScope.setorId,
      ativo: true,
    }, { onConflict: 'id' });

  if (upsertError) {
    await rollbackCreatedUser(adminClient, userId);
    return json({ success: false, error: `Falha ao sincronizar perfil do usuário: ${upsertError.message}` }, 500);
  }

  const supervisorSync = await syncSupervisorias(adminClient, actorId, userId, role, supervisorEquipeIds);
  if (!supervisorSync.ok) {
    await rollbackCreatedUser(adminClient, userId);
    return json({ success: false, error: supervisorSync.error }, supervisorSync.status);
  }

  return json({
    success: true,
    user_id: userId,
    senha,
    message: 'Usuário criado com sucesso.',
  });
};

const handleToggleActive = async (
  adminClient: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) => {
  const userId = normalizeText(payload.userId);
  if (!userId) return json({ success: false, error: 'Usuário obrigatório.' }, 400);

  const { data: targetUser, error: targetError } = await adminClient
    .from('users')
    .select('id, role, ativo')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) {
    return json({ success: false, error: `Falha ao carregar usuário: ${targetError.message}` }, 500);
  }

  if (!targetUser) {
    return json({ success: false, error: 'Usuário não encontrado.' }, 404);
  }

  const currentActive = targetUser.ativo !== false;
  const nextActive = !currentActive;

  if (targetUser.role === 'admin' && nextActive === false) {
    return json({
      success: false,
      error: 'Não é possível desativar um administrador. Remova o perfil admin primeiro.',
    }, 400);
  }

  const { error: updateError } = await adminClient
    .from('users')
    .update({ ativo: nextActive })
    .eq('id', userId);

  if (updateError) {
    return json({ success: false, error: `Falha ao atualizar status do usuário: ${updateError.message}` }, 500);
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: nextActive ? 'none' : '876000h',
  });

  if (authError) {
    await adminClient
      .from('users')
      .update({ ativo: currentActive })
      .eq('id', userId);

    return json({
      success: false,
      error: `Falha ao sincronizar status no Auth: ${authError.message}`,
    }, 502);
  }

  return json({
    success: true,
    ativo: nextActive,
    message: nextActive ? 'Usuário reativado com sucesso.' : 'Usuário desativado com sucesso.',
  });
};

const handleResetPassword = async (
  adminClient: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) => {
  const userId = normalizeText(payload.userId);
  const newPassword = normalizeText(payload.newPassword);

  if (!userId) return json({ success: false, error: 'Usuário obrigatório.' }, 400);
  if (newPassword.length < 6) {
    return json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres.' }, 400);
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return json({ success: false, error: `Falha ao resetar senha: ${error.message}` }, 502);
  }

  return json({
    success: true,
    message: 'Senha alterada com sucesso.',
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Método não suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const serviceRoleKey =
    Deno.env.get('APP_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: 'Configuração do Supabase ausente no ambiente da função.' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return json({ success: false, error: 'Token de autenticação ausente.' }, 401);
  }

  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return json({ success: false, error: 'Token de autenticação inválido.' }, 401);
  }

  let requestBody: AdminPayload;
  try {
    requestBody = await req.json();
  } catch {
    return json({ success: false, error: 'Corpo JSON inválido.' }, 400);
  }

  const action = requestBody.action;
  const payload = requestBody.payload || {};

  if (!action) {
    return json({ success: false, error: 'Ação administrativa obrigatória.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ success: false, error: 'Sessão inválida ou expirada.' }, 401);
  }

  const actorValidation = await isAdminActor(adminClient, authData.user.id);
  if (!actorValidation.ok) {
    return json({ success: false, error: actorValidation.error }, actorValidation.status);
  }

  switch (action) {
    case 'create':
      return handleCreateUser(adminClient, actorValidation.actor.id, payload);
    case 'toggle-active':
      return handleToggleActive(adminClient, payload);
    case 'reset-password':
      return handleResetPassword(adminClient, payload);
    default:
      return json({ success: false, error: `Ação não suportada: ${action}` }, 400);
  }
});
