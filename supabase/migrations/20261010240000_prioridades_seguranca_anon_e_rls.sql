-- App "Prioridades e Urgências" — fecha as falhas de autorização (PU-01, PU-02).
--
-- ────────────────────────────────────────────────────────────────────────────
-- CAUSA-RAIZ, IDENTIFICADA EM TESTE ADVERSARIAL
-- ────────────────────────────────────────────────────────────────────────────
-- O Supabase concede privilégios DEFAULT a `anon` e `authenticated` em objetos
-- criados no schema `public`, e concede EXECUTE em funções a PUBLIC. Portanto
-- `GRANT ... TO authenticated`, sozinho, NÃO restringe nada: o grant implícito
-- de `anon` permanece. Foi assim que, sem login, se conseguiu:
--
--   - LER e ESCREVER nas três tabelas criadas sem `ENABLE ROW LEVEL SECURITY`
--     (sem RLS, o grant de tabela vale para todas as linhas);
--   - EXECUTAR `prioridades_processar_prazos_vencidos()` e
--     `prioridades_proximo_da_fila()`, que são SECURITY DEFINER — rodam com
--     privilégio de owner e por isso ignoram a RLS;
--   - INSERIR em `prioridades_anotacoes_historico`.
--
-- Regra adotada daqui em diante para este módulo: **toda** tabela nova recebe
-- `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL FROM anon`; **toda** função interna
-- recebe `REVOKE ALL FROM PUBLIC, anon` e grant só a quem realmente chama.
--
-- O escopo é deliberadamente restrito ao prefixo `prioridades_` — outros
-- módulos do Gerenciador não são afetados por esta migration.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. RLS nas tabelas de catálogo e no cursor (PU-01)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prioridades_tipos_solicitante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_tipos_prioridade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_round_robin_cursor ENABLE ROW LEVEL SECURITY;

-- Nada de tabela para `anon`, em nenhuma tabela do módulo.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tabela
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'prioridades\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM anon', r.tabela);
  END LOOP;
END $$;

-- Catálogos: leitura para autenticados, escrita só por admin.
DROP POLICY IF EXISTS "prioridades_tipos_solicitante_select" ON public.prioridades_tipos_solicitante;
CREATE POLICY "prioridades_tipos_solicitante_select"
  ON public.prioridades_tipos_solicitante FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prioridades_tipos_solicitante_admin_write" ON public.prioridades_tipos_solicitante;
CREATE POLICY "prioridades_tipos_solicitante_admin_write"
  ON public.prioridades_tipos_solicitante FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "prioridades_tipos_prioridade_select" ON public.prioridades_tipos_prioridade;
CREATE POLICY "prioridades_tipos_prioridade_select"
  ON public.prioridades_tipos_prioridade FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prioridades_tipos_prioridade_admin_write" ON public.prioridades_tipos_prioridade;
CREATE POLICY "prioridades_tipos_prioridade_admin_write"
  ON public.prioridades_tipos_prioridade FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- O cursor do rodízio não tem policy nenhuma: só as funções SECURITY DEFINER o
-- movem, e o cliente nunca precisa lê-lo (ele guarda id de servidor).
DROP POLICY IF EXISTS "prioridades_round_robin_cursor_select" ON public.prioridades_round_robin_cursor;

REVOKE ALL ON public.prioridades_tipos_solicitante FROM authenticated;
REVOKE ALL ON public.prioridades_tipos_prioridade FROM authenticated;
REVOKE ALL ON public.prioridades_round_robin_cursor FROM authenticated;
GRANT SELECT ON public.prioridades_tipos_solicitante TO authenticated;
GRANT SELECT ON public.prioridades_tipos_prioridade TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Funções internas deixam de ser executáveis de fora (PU-02)
-- ─────────────────────────────────────────────────────────────────────────
--
-- São chamadas de dentro de outras RPCs ou pelo cron. Nenhuma delas deve ser
-- invocável pela API — muito menos por anônimo.

REVOKE ALL ON FUNCTION public.prioridades_registrar_historico(
  bigint, public.prioridades_status, public.prioridades_status, text, text)
  FROM PUBLIC, anon, authenticated;

-- `proximo_da_fila` devolve NOMES de servidores: não pode sair para cliente algum.
REVOKE ALL ON FUNCTION public.prioridades_proximo_da_fila(text, uuid)
  FROM PUBLIC, anon, authenticated;

-- A varredura de prazos fica restrita ao cron (owner) e ao service_role.
REVOKE ALL ON FUNCTION public.prioridades_processar_prazos_vencidos()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_processar_prazos_vencidos() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Varredura geral: nenhuma função do módulo para `anon`
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'prioridades\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.assinatura);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.assinatura);
  END LOOP;
END $$;

-- Reconcede ao papel autenticado apenas o que a interface chama diretamente.
-- Sem esta lista explícita, o passo anterior deixaria a aplicação sem acesso.
DO $$
DECLARE
  assinatura text;
  alvos text[] := ARRAY[
    'public.prioridades_meu_perfil()',
    'public.prioridades_minha_upj()',
    'public.prioridades_sou_atendente()',
    'public.prioridades_sou_gestor_ou_conferente()',
    'public.prioridades_sou_upj()',
    'public.prioridades_pode_ver(bigint)',
    'public.prioridades_pode_editar(bigint)',
    'public.prioridades_designacao_ativa(public.prioridades_perfil_tipo[])',
    'public.prioridades_anteriores(text, integer)',
    'public.prioridades_buscar_usuarios(text, uuid)',
    'public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid)',
    'public.prioridades_encerrar_designacao(uuid)',
    'public.prioridades_alternar_vinculacao(uuid, boolean)',
    'public.prioridades_remover_perfil(uuid)',
    'public.prioridades_criar_anotacao(jsonb)',
    'public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb)',
    'public.prioridades_responder_devolucao(bigint, text)',
    'public.prioridades_analisar(bigint, text, text, text, boolean)'
  ];
BEGIN
  FOREACH assinatura IN ARRAY alvos LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', assinatura);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Função não encontrada ao reconceder grant: %', assinatura;
    END;
  END LOOP;
END $$;

-- A varredura de prazos é chamada também pela própria interface (fallback
-- quando o pg_cron não está disponível). Continua acessível a autenticado, mas
-- a função valida que existe perfil ativo — ver migration seguinte.
GRANT EXECUTE ON FUNCTION public.prioridades_processar_prazos_vencidos() TO authenticated;

COMMIT;
