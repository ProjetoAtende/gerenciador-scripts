-- Diagnostico: usuarios ativos em public.users sem correspondente em auth.users
-- Uso recomendado:
-- 1. Execute os SELECTs de auditoria.
-- 2. Para cada usuario listado, decida entre:
--    - recriar/regularizar a conta em auth.users e depois ressicronizar public.users; ou
--    - desativar o usuario em public.users se ele nao deveria mais operar no sistema.
--
-- Observacao importante:
-- public.user_preferences.user_id referencia auth.users(id).
-- Logo, qualquer usuario presente so em public.users falhara ao salvar preferencias
-- e avatar da Arena.

-- 1) Usuarios ativos em public.users sem auth correspondente.
select
  u.id,
  u.nome,
  u.email,
  u.role,
  u.equipe_id,
  u.setor_id,
  u.ativo,
  up.gamificacao_avatar_id,
  up.updated_at as preferencias_updated_at
from public.users u
left join auth.users au
  on au.id = u.id
left join public.user_preferences up
  on up.user_id = u.id
where coalesce(u.ativo, true)
  and au.id is null
order by u.nome;

-- 2) Contagem resumida do problema.
select
  count(*) as usuarios_ativos_sem_auth
from public.users u
left join auth.users au
  on au.id = u.id
where coalesce(u.ativo, true)
  and au.id is null;

-- 3) Inconsistencia inversa: usuarios em auth.users ainda nao espelhados em public.users.
select
  au.id,
  au.email,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'nome'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
    ''
  ) as nome_auth,
  au.created_at,
  au.updated_at
from auth.users au
left join public.users u
  on u.id = au.id
where u.id is null
order by au.email;

-- 4) Backfill seguro de public.users a partir de auth.users.
-- Execute apos regularizar contas em auth.users quando houver usuarios faltando no espelho public.users.
-- Este bloco segue o contrato de sincronizacao definido nas migrations de auth/public users.
--
-- insert into public.users (id, email, nome, role, ativo)
-- select
--   au.id,
--   lower(coalesce(au.email, '')),
--   coalesce(
--     nullif(trim(au.raw_user_meta_data ->> 'nome'), ''),
--     nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
--     ''
--   ),
--   public.normalize_user_role(au.raw_user_meta_data ->> 'role'),
--   true
-- from auth.users au
-- on conflict (id) do update
-- set email = excluded.email,
--     nome = case
--       when excluded.nome <> '' then excluded.nome
--       else public.users.nome
--     end,
--     role = case
--       when public.users.role is null then excluded.role
--       when public.users.role = 'catequista'::public.user_role then excluded.role
--       else public.users.role
--     end,
--     ativo = coalesce(public.users.ativo, true),
--     updated_at = timezone('utc', now());

-- 5) Opcao de saneamento para usuarios orfaos que nao devem mais operar.
-- Revise o WHERE antes de executar.
--
-- update public.users
-- set ativo = false,
--     updated_at = timezone('utc', now())
-- where id in (
--   'ca280602-63fe-41b0-afd4-3dcd6d7dbccd', -- Fabiano Reis
--   '84511797-bb7a-4795-9a83-ea4b3900ea94'  -- Jussara Toledo
-- );

-- 6) Consulta focal para o caso da Arena/avatar.
-- Estes usuarios vao falhar em public.user_preferences enquanto nao existirem em auth.users.
select
  u.id,
  u.nome,
  u.email,
  case
    when au.id is null then 'falha ao salvar preferencias/avatar'
    else 'ok'
  end as status_avatar
from public.users u
left join auth.users au
  on au.id = u.id
where u.id in (
  'ca280602-63fe-41b0-afd4-3dcd6d7dbccd', -- Fabiano Reis
  '84511797-bb7a-4795-9a83-ea4b3900ea94'  -- Jussara Toledo
)
order by u.nome;
