-- App "Prioridades e Urgências" — carga inicial das UPJs da unidade-piloto.
--
-- Unidade-piloto conforme a seção 10.1 da especificação:
-- "9 UPJs, 45 Varas Cíveis, 90 Gabinetes" (Fórum Central Cível).
--
-- ────────────────────────────────────────────────────────────────────────────
-- POR QUE O MAPEAMENTO idOrgao → UPJ NÃO É SEMEADO AQUI
-- ────────────────────────────────────────────────────────────────────────────
-- A tabela `prioridades_orgaos_upj` fica deliberadamente vazia nesta migration.
--
-- Motivo: o espaço de `idOrgao` do DJEN é amplo e mutável, e a varredura
-- completa pela API pública é instável (o endpoint sem filtro forte devolve
-- HTTP 500 e timeouts com frequência). Semeá-lo "no chute" produziria um
-- mapeamento silenciosamente errado — pior do que não ter mapeamento, porque o
-- erro só apareceria como anotação entregue à UPJ errada.
--
-- Estratégia adotada: mapeamento INCREMENTAL.
--   1. O usuário informa o número do processo (RF-ATD-03).
--   2. O DJEN devolve `idOrgao` + `nomeOrgao`.
--   3. Se `idOrgao` não está mapeado, a tela exibe o nome do órgão e pede a
--      UPJ; o Gestor confirma e o par é gravado (ver
--      `registrarMapeamentoOrgao` em prioridadesService.ts).
--   4. A partir daí, toda anotação daquele órgão detecta a UPJ sozinha.
--
-- Isso converge rápido: no Fórum Central Cível, cada idOrgao cobre uma faixa de
-- Varas inteira (ex.: "UPJ da 26ª a 30ª Varas Cíveis"), então poucas dezenas de
-- confirmações cobrem toda a unidade-piloto.
--
-- [AÇÃO NECESSÁRIA] Confirmar com a STI se o mapeamento deve ser pré-carregado
-- por importação dos cadastros internos (fonte autoritativa) em vez de
-- incremental. Se sim, esta migration deve ser complementada.

BEGIN;

INSERT INTO public.prioridades_upjs (codigo, nome, foro) VALUES
  ('FCC-01-05',  'UPJ da 1ª a 5ª Varas Cíveis',   'Foro Central Cível'),
  ('FCC-06-10',  'UPJ da 6ª a 10ª Varas Cíveis',  'Foro Central Cível'),
  ('FCC-11-15',  'UPJ da 11ª a 15ª Varas Cíveis', 'Foro Central Cível'),
  ('FCC-16-20',  'UPJ da 16ª a 20ª Varas Cíveis', 'Foro Central Cível'),
  ('FCC-21-25',  'UPJ da 21ª a 25ª Varas Cíveis', 'Foro Central Cível'),
  ('FCC-26-30',  'UPJ da 26ª a 30ª Varas Cíveis', 'Foro Central Cível'),
  ('FCC-31-35',  'UPJ da 31ª a 35ª Varas Cíveis', 'Foro Central Cível'),
  ('FCC-36-40',  'UPJ da 36ª a 40ª Varas Cíveis', 'Foro Central Cível'),
  ('FCC-41-45',  'UPJ da 41ª a 45ª Varas Cíveis', 'Foro Central Cível')
ON CONFLICT (codigo) DO UPDATE
SET nome = excluded.nome,
    foro = excluded.foro,
    atualizado_em = now();

-- Catálogo auxiliar: o idOrgao observado em produção para o órgão agrupado
-- "UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível". Mantido como primeira
-- linha do mapeamento para que o fluxo tenha um exemplo funcional verificável.
INSERT INTO public.prioridades_orgaos_upj (id_orgao_djen, nome_orgao_djen, vara, upj_id)
SELECT 98517,
       'UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível',
       26,
       u.id
FROM public.prioridades_upjs u
WHERE u.codigo = 'FCC-26-30'
ON CONFLICT (id_orgao_djen) DO UPDATE
SET nome_orgao_djen = excluded.nome_orgao_djen,
    vara = excluded.vara,
    upj_id = excluded.upj_id,
    atualizado_em = now();

COMMIT;
