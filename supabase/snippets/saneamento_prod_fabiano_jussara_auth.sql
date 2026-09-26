-- Saneamento de producao: recriar vinculo em auth.users para usuarios orfaos
-- Alvo:
--   - Fabiano Reis
--   - Jussara Toledo
--
-- Quando usar:
--   Execute somente se estes usuarios ainda devem conseguir autenticar no sistema.
--   Se nao devem mais acessar, prefira desativar em public.users e nao recriar auth.users.
--
-- Antes de executar:
--   1. Defina senhas temporarias abaixo.
--   2. Rode a secao de pre-check.
--   3. Execute o bloco transacional.
--   4. Force reset de senha pelos canais operacionais apropriados, se aplicavel.

-- ============================================================================
-- PRE-CHECK
-- ============================================================================
select
  u.id,
  u.nome,
  u.email,
  u.role,
  u.ativo,
  case when au.id is null then 'ORFAO_EM_AUTH' else 'OK' end as status_auth,
  case when up.user_id is null then 'SEM_PREFERENCIAS' else 'COM_PREFERENCIAS' end as status_preferences
from public.users u
left join auth.users au
  on au.id = u.id
left join public.user_preferences up
  on up.user_id = u.id
where u.id in (
  'ca280602-63fe-41b0-afd4-3dcd6d7dbccd', -- Fabiano Reis
  '84511797-bb7a-4795-9a83-ea4b3900ea94'  -- Jussara Toledo
)
order by u.nome;

-- ============================================================================
-- REPARO
-- ============================================================================
begin;

do $$
declare
  v_now timestamptz := timezone('utc', now());
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';

  v_fabiano_id uuid := 'ca280602-63fe-41b0-afd4-3dcd6d7dbccd';
  v_fabiano_email text := 'fareis@tjsp.jus.br';
  v_fabiano_nome text := 'Fabiano Reis';
  v_fabiano_role text := 'user';
  v_fabiano_password text := '<DEFINIR_SENHA_TEMPORARIA_FABIANO>';

  v_jussara_id uuid := '84511797-bb7a-4795-9a83-ea4b3900ea94';
  v_jussara_email text := 'jutoledo@tjsp.jus.br';
  v_jussara_nome text := 'Jussara Toledo';
  v_jussara_role text := 'user';
  v_jussara_password text := '<DEFINIR_SENHA_TEMPORARIA_JUSSARA>';
begin
  if v_fabiano_password like '<DEFINIR_%>' or v_jussara_password like '<DEFINIR_%>' then
    raise exception 'Defina as senhas temporarias antes de executar o saneamento.';
  end if;

  if not exists (select 1 from auth.users where id = v_fabiano_id) then
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      is_sso_user,
      deleted_at
    )
    values (
      v_fabiano_id,
      v_instance_id,
      'authenticated',
      'authenticated',
      v_fabiano_email,
      crypt(v_fabiano_password, gen_salt('bf', 10)),
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'nome', v_fabiano_nome,
        'name', v_fabiano_nome,
        'role', v_fabiano_role,
        'email_verified', true
      ),
      v_now,
      v_now,
      '',
      '',
      '',
      '',
      false,
      null
    );
  end if;

  if not exists (select 1 from auth.users where id = v_jussara_id) then
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      is_sso_user,
      deleted_at
    )
    values (
      v_jussara_id,
      v_instance_id,
      'authenticated',
      'authenticated',
      v_jussara_email,
      crypt(v_jussara_password, gen_salt('bf', 10)),
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'nome', v_jussara_nome,
        'name', v_jussara_nome,
        'role', v_jussara_role,
        'email_verified', true
      ),
      v_now,
      v_now,
      '',
      '',
      '',
      '',
      false,
      null
    );
  end if;

  -- Reforca consistencia do espelho operacional.
  update public.users
  set email = v_fabiano_email,
      nome = v_fabiano_nome,
      ativo = true,
      updated_at = v_now
  where id = v_fabiano_id;

  update public.users
  set email = v_jussara_email,
      nome = v_jussara_nome,
      ativo = true,
      updated_at = v_now
  where id = v_jussara_id;

  -- Garante registro base de preferencias para evitar primeira escrita surpresa.
  insert into public.user_preferences (
    user_id,
    dark_mode,
    open_cards_in_new_tab,
    gamificacao_avatar_id
  )
  values
    (v_fabiano_id, false, false, null),
    (v_jussara_id, false, false, null)
  on conflict (user_id) do nothing;
end
$$;

commit;

-- ============================================================================
-- POS-CHECK
-- ============================================================================
select
  u.id,
  u.nome,
  u.email as public_email,
  au.email as auth_email,
  u.ativo,
  up.gamificacao_avatar_id,
  up.updated_at as preferencias_updated_at
from public.users u
left join auth.users au
  on au.id = u.id
left join public.user_preferences up
  on up.user_id = u.id
where u.id in (
  'ca280602-63fe-41b0-afd4-3dcd6d7dbccd', -- Fabiano Reis
  '84511797-bb7a-4795-9a83-ea4b3900ea94'  -- Jussara Toledo
)
order by u.nome;
