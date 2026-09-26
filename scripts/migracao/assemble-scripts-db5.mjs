import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const extracted = read('supabase/migrations/_scripts_db5_extracted.sql');
const relax = read('supabase/migrations_legacy/20260505103000_relaxar_validacao_categoria_scripts.sql');
const publicar = read('supabase/migrations_legacy/20260923173000_scripts_publicar_sem_email.sql');
const stats = read('supabase/migrations_legacy/20260923150000_restore_stats_scripts_em_numeros.sql');

const notifFn = `CREATE OR REPLACE FUNCTION public.notificacoes_destinatarios(
  p_codigo text,
  p_equipe_contexto uuid DEFAULT NULL
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT u.id AS user_id
  FROM public.users u
  WHERE u.ativo IS DISTINCT FROM FALSE
    AND EXISTS (
      SELECT 1
      FROM public.permissoes_grants g
      WHERE g.objeto_codigo = p_codigo
        AND (
          (
            g.target_type = 'usuario'
            AND g.target_id = u.id::text
          )
          OR (
            g.target_type = 'equipe'
            AND u.equipe_id IS NOT NULL
            AND g.target_id = u.equipe_id::text
            AND (p_equipe_contexto IS NULL OR u.equipe_id = p_equipe_contexto)
          )
          OR (
            g.target_type = 'role'
            AND u.role IS NOT NULL
            AND g.target_id = u.role::text
            AND (p_equipe_contexto IS NULL OR u.equipe_id = p_equipe_contexto)
          )
        )
    );
$$;

COMMENT ON FUNCTION public.notificacoes_destinatarios(text, uuid) IS
  'Resolve destinatarios ativos de notificacoes a partir de permissoes_grants.';

REVOKE ALL ON FUNCTION public.notificacoes_destinatarios(text, uuid) FROM PUBLIC;`;

const publicarFns = publicar.replace(
  /ALTER TABLE public\.script_notificacoes[\s\S]*?;\s*\n+/,
  '',
);

const statsBlock = stats
  .replace(/^--[\s\S]*?-- RPCs[\s\S]*?\n\n/m, '')
  .replace(
    /-- Curadoria 3\.2\.x[\s\S]*$/m,
    `-- Grants de modal espelham curadoria (roles)
INSERT INTO public.permissoes_grants (objeto_codigo, target_type, target_id)
VALUES
  ('scripts.em_numeros_modal', 'role', 'supervisor'),
  ('scripts.em_numeros_modal', 'role', 'coordenador'),
  ('home.card.scripts_em_numeros', 'role', 'supervisor'),
  ('home.card.scripts_em_numeros', 'role', 'coordenador')
ON CONFLICT (objeto_codigo, target_type, target_id) DO NOTHING;
`,
  );

const triggers = `
-- Triggers em scripts_customizados
DROP TRIGGER IF EXISTS trg_atribuir_numero_referencia ON public.scripts_customizados;
CREATE TRIGGER trg_atribuir_numero_referencia
  BEFORE INSERT ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.fn_atribuir_numero_referencia();

DROP TRIGGER IF EXISTS trigger_resetar_curadoria_ao_editar ON public.scripts_customizados;
CREATE TRIGGER trigger_resetar_curadoria_ao_editar
  BEFORE UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.resetar_curadoria_ao_editar();

DROP TRIGGER IF EXISTS trigger_salvar_conteudo_original ON public.scripts_customizados;
CREATE TRIGGER trigger_salvar_conteudo_original
  BEFORE INSERT ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.salvar_conteudo_original_script();

DROP TRIGGER IF EXISTS trigger_scripts_classificacao_pendente ON public.scripts_customizados;
CREATE TRIGGER trigger_scripts_classificacao_pendente
  BEFORE INSERT OR UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.marcar_script_para_classificacao();

DROP TRIGGER IF EXISTS trigger_sync_tem_conteudo_atendente ON public.scripts_customizados;
CREATE TRIGGER trigger_sync_tem_conteudo_atendente
  BEFORE INSERT OR UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.sync_tem_conteudo_atendente();

DROP TRIGGER IF EXISTS trigger_validar_script_cat_hierarquica ON public.scripts_customizados;
CREATE TRIGGER trigger_validar_script_cat_hierarquica
  BEFORE INSERT OR UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.validar_script_categoria_hierarquica();
`;

const grants = `
GRANT EXECUTE ON FUNCTION public.notificacoes_destinatarios(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_notificacao_script(uuid, uuid, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_proposta_script(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_proposta_script(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rejeitar_proposta_script(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reenviar_proposta_script(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_script_inicial(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_contestacao_script(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_versao_curadoria(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_versao_v1_publicacao(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.determinar_dominio_script(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_curadoria_script(uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_revisor_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_exclusao_script(uuid, uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reativar_script(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_versoes_resumo(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_curadoria_script_publicado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_exclusao_script(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pasta_desativados_id(uuid) TO authenticated;
`;

const out = [
  extracted.replace(/^-- DB-5[\s\S]*?SET search_path TO public;\s*\n\n/, ''),
  relax.trim(),
  notifFn.trim(),
  publicarFns.trim(),
  statsBlock.trim(),
  triggers.trim(),
  grants.trim(),
]
  .filter(Boolean)
  .join('\n\n');

fs.writeFileSync(
  'supabase/migrations/20260927221000_scripts_db5_functions.sql',
  `-- DB-5 (parte 2): Scripts — RPCs, notificações, stats e triggers\n\n${out}\n`,
);
fs.unlinkSync('supabase/migrations/_scripts_db5_extracted.sql');
console.log('assembled', out.length);
