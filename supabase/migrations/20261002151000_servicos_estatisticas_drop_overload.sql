-- PostgREST não resolve overload (uuid,text) vs (uuid,text,date,date) com defaults.
-- Mantém apenas a assinatura com datas opcionais.

BEGIN;

DROP FUNCTION IF EXISTS public.obter_servicos_estatisticas_completas(uuid, text);

COMMIT;
