-- App "Prioridades e Urgências" — remove sonda de diagnóstico remanescente.
--
-- Durante a investigação do portão NULL foram criadas funções de diagnóstico
-- temporárias. A migration 20261010430000 removeu `prioridades_diag_funcao`, mas
-- `prioridades_diag_decisao` escapou: o arquivo que a criava foi apagado antes de
-- ser enviado, porém a função já existia no banco desde uma execução anterior.
--
-- Função de diagnóstico exposta na API é superfície desnecessária — ela lê
-- perfil, designação e papel de qualquer usuário. Remoção explícita aqui.

BEGIN;

DROP FUNCTION IF EXISTS public.prioridades_diag_decisao(uuid);
DROP FUNCTION IF EXISTS public.prioridades_diag_funcao(text);
DROP TABLE IF EXISTS public.prioridades_diag_log;

COMMIT;
