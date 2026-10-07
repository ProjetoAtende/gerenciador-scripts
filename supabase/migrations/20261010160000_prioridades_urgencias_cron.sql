-- App "Prioridades e Urgências" — cron do temporizador de 24 h (RF-GER-06).
--
-- Segue o padrão já usado no projeto (20260928130000_stack_tag_jobs_cron.sql):
-- a extensão é criada em um bloco tolerante a falha e o agendamento vive em um
-- bloco separado, porque PL/pgSQL compila o corpo inteiro no primeiro uso — um
-- `RETURN` antecipado não impediria o erro de parse em `cron.schedule` quando a
-- extensão não existe.

DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível neste ambiente: %', SQLERRM;
END;
$cron$;

DO $cron$
DECLARE
  v_jobid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não instalado — agende public.prioridades_processar_prazos_vencidos() externamente (Edge Function + Scheduler).';
    RETURN;
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'prioridades_prazos_24h' LIMIT 1;
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  -- A cada 10 minutos: o prazo é de 24 h, então granularidade fina não é
  -- necessária e o custo cai.
  --
  -- [A DEFINIR na especificação] O documento não decide se o prazo de 24 h é em
  -- horas corridas ou úteis. Hoje está implementado em horas corridas — inclusive
  -- fins de semana, feriados e recesso. Se a decisão for por horas úteis, o
  -- cálculo de `prazo_resposta_em` nas RPCs precisa mudar junto.
  --
  -- Ponto formal de decisão: PD-01 em docs/PRIORIDADES_URGENCIAS_PENDENCIAS.md
  -- (existe tabela de feriados reaproveitável: public.escala_agenda_institucional).
  PERFORM cron.schedule(
    'prioridades_prazos_24h',
    '*/10 * * * *',
    $cmd$SELECT public.prioridades_processar_prazos_vencidos();$cmd$
  );

  RAISE NOTICE 'pg_cron: agendado prioridades_prazos_24h a cada 10 minutos.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível agendar prioridades_prazos_24h: %', SQLERRM;
END;
$cron$;
