-- Prioridades e Urgências v2 — PLANO B: desfaz o que a migration da etapa 2
-- (20261123100000_prioridades_v2_etapa2.sql) muda no comportamento da v1.
--
-- Usar SÓ se a v1 apresentar problema depois da etapa 3. Não apaga dados:
--   1. remove o gatilho que grava "conferido_por_nome" (item H);
--   2. volta os nomes e avisos antigos dos tipos J e K;
--   3. retira o tipo "Tramitação prioritária – Perito" (L) e a regra que o aceita.
--      Se alguma anotação já tiver usado o tipo Perito, o script PARA sem mudar nada
--      (é preciso decidir antes o que fazer com essas anotações).
--
-- O resto da migration (colunas, funções e tabela novas, com prefixo v2) não é
-- usado pela v1 e pode ficar: a v2 simplesmente deixa de funcionar direito.
-- Valores antigos copiados do backup de 22/11/2026 (lhofkimrmzyjazfpqesd_2026-11-22_14h24).
--
-- Rodar:  supabase db query --linked -f scripts/prioridades-v2/desfazer-etapa2-v1.sql
-- Tudo numa transação: ou muda tudo, ou nada.

BEGIN;

DO $$
DECLARE
  v_qtd integer;
BEGIN
  SELECT count(*) INTO v_qtd FROM public.prioridades_anotacoes WHERE tipo_prioridade = 'prioridade-perito';
  IF v_qtd > 0 THEN
    RAISE EXCEPTION 'Nada foi alterado: % anotação(ões) usam o tipo Perito. Decidir antes o que fazer com elas.', v_qtd;
  END IF;
END $$;

-- 1. Item H
DROP TRIGGER IF EXISTS prioridades_conferido_por_nome ON public.prioridades_anotacoes;
DROP FUNCTION IF EXISTS public.prioridades_preencher_conferido_por_nome();

-- 2. Itens J e K: textos exatamente como estavam
UPDATE public.prioridades_tipos_prioridade
SET label = 'Erro material em peça processual', atualizado_em = now()
WHERE codigo = 'erro-material';

UPDATE public.prioridades_tipos_prioridade
SET label = 'Consta "URGENTE" na decisão/sentença',
    aviso = 'Sem menção expressa a "urgente"/"com urgência", a anotação será rejeitada. Pedidos de apressamento de MLE por "verba alimentar" não se enquadram: orientar agendamento com o(a) Magistrado(a).',
    atualizado_em = now()
WHERE codigo = 'urgencia-determinada';

UPDATE public.prioridades_tipos_prioridade
SET aviso = 'Prioridade geral. Para decisões com urgência expressa, usar "Consta ''URGENTE''...".',
    atualizado_em = now()
WHERE codigo = 'prioridade-idoso';

-- 3. Item L
DELETE FROM public.prioridades_regras_especiais_v2 WHERE tipo_prioridade = 'prioridade-perito';
DELETE FROM public.prioridades_tipos_prioridade WHERE codigo = 'prioridade-perito';
UPDATE public.prioridades_tipos_prioridade SET ordem = 9, atualizado_em = now() WHERE codigo = 'outros';

ALTER TABLE public.prioridades_anotacoes DROP CONSTRAINT IF EXISTS prioridades_anotacoes_tipo_prioridade_check;
ALTER TABLE public.prioridades_anotacoes ADD CONSTRAINT prioridades_anotacoes_tipo_prioridade_check
  CHECK (tipo_prioridade IN ('urgencia-determinada', 'prazo-excedido', 'fora-localizador',
                             'erro-material', 'medico-saude', 'prioridade-doenca',
                             'prioridade-pcd', 'prioridade-idoso', 'outros'));

COMMIT;
