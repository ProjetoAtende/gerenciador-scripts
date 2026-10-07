-- App "Prioridades e Urgências" — registra o ponto de decisão do prazo no job.
--
-- A migration 20261010160000 já foi aplicada: editar o comentário dela não chega
-- ao banco. Este arquivo regrava o agendamento com o mesmo corpo e acrescenta a
-- referência ao ponto formal de decisão, para que quem inspecionar o job veja
-- que o prazo em horas corridas é uma escolha provisória, não um descuido.
--
-- Ponto formal: PD-01 em docs/PRIORIDADES_URGENCIAS_PENDENCIAS.md
--
-- Relevante para a decisão: já existe tabela de feriados/emendas/recesso no
-- projeto (`public.escala_agenda_institucional`, do módulo Escala), então migrar
-- para horas úteis não exige criar a estrutura de calendário — apenas consultá-la
-- e definir quem a mantém atualizada.

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

  -- A cada 10 minutos. O prazo é de 24 h, então granularidade fina não é
  -- necessária e o custo cai.
  PERFORM cron.schedule(
    'prioridades_prazos_24h',
    '*/10 * * * *',
    $cmd$SELECT public.prioridades_processar_prazos_vencidos();$cmd$
  );

  RAISE NOTICE 'pg_cron: prioridades_prazos_24h reagendado (prazo em horas corridas — PD-01 em aberto).';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível agendar prioridades_prazos_24h: %', SQLERRM;
END;
$cron$;
