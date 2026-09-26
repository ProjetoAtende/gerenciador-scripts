-- RPCs Boss Only (subset: setores, equipes, toggle usuário — sem GSE)

CREATE OR REPLACE FUNCTION public.admin_criar_setor(p_nome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setor_id uuid;
BEGIN
  IF NOT is_boss() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;

  IF EXISTS (SELECT 1 FROM setores WHERE nome = p_nome) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe um setor com este nome');
  END IF;

  INSERT INTO setores (nome) VALUES (p_nome) RETURNING id INTO v_setor_id;
  RETURN jsonb_build_object('success', true, 'id', v_setor_id, 'message', 'Setor criado');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_atualizar_setor(p_id uuid, p_nome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_boss() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM setores WHERE id = p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Setor não encontrado');
  END IF;

  IF EXISTS (SELECT 1 FROM setores WHERE nome = p_nome AND id != p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe outro setor com este nome');
  END IF;

  UPDATE setores SET nome = p_nome, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'message', 'Setor atualizado');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deletar_setor(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_boss() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF EXISTS (SELECT 1 FROM equipes WHERE setor_id = p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível excluir: existem equipes vinculadas a este setor');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE setor_id = p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível excluir: existem usuários vinculados a este setor');
  END IF;

  DELETE FROM setores WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'message', 'Setor excluído');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_criar_equipe(p_nome text, p_setor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipe_id uuid;
BEGIN
  IF NOT is_boss() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM setores WHERE id = p_setor_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Setor não encontrado');
  END IF;

  IF EXISTS (SELECT 1 FROM equipes WHERE nome = p_nome AND setor_id = p_setor_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe uma equipe com este nome neste setor');
  END IF;

  INSERT INTO equipes (nome, setor_id) VALUES (p_nome, p_setor_id) RETURNING id INTO v_equipe_id;
  RETURN jsonb_build_object('success', true, 'id', v_equipe_id, 'message', 'Equipe criada');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_atualizar_equipe(p_id uuid, p_nome text, p_setor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_boss() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM equipes WHERE id = p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Equipe não encontrada');
  END IF;

  IF EXISTS (SELECT 1 FROM equipes WHERE nome = p_nome AND setor_id = p_setor_id AND id != p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe outra equipe com este nome neste setor');
  END IF;

  UPDATE equipes SET nome = p_nome, setor_id = p_setor_id, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'message', 'Equipe atualizada');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deletar_equipe(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_boss() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE equipe_id = p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível excluir: existem usuários vinculados a esta equipe');
  END IF;

  DELETE FROM equipes WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'message', 'Equipe excluída');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_usuario_ativo(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_status boolean;
  v_email text;
  v_role text;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  SELECT email, role::text, NOT ativo INTO v_email, v_role, v_novo_status
  FROM users WHERE id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  IF v_role = 'admin' AND v_novo_status = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível desativar um administrador');
  END IF;

  IF p_user_id = auth.uid() AND v_novo_status = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível desativar sua própria conta');
  END IF;

  UPDATE users SET ativo = v_novo_status WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'ativo', v_novo_status,
    'message', CASE WHEN v_novo_status THEN 'Usuário ativado' ELSE 'Usuário desativado' END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_criar_setor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_atualizar_setor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deletar_setor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_criar_equipe(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_atualizar_equipe(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deletar_equipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_usuario_ativo(uuid) TO authenticated;
