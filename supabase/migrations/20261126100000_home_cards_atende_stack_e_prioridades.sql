-- Home: controle de permissão do card "Atende Stack" e novos nomes dos cards de
-- Prioridades e Urgências.
--
-- 1. O card "Atende Stack" aparecia para TODOS os usuários: não tinha código de
--    permissão e, por isso, não constava no Boss Only. Passa a ter o código
--    `home.card.atende_stack`. Para ninguém perder o card no dia da publicação,
--    ele recebe as mesmas liberações que o card "Escala" tem hoje (perfis e
--    equipes). Depois disso, o Boss Only ajusta como quiser.
--
-- 2. Os nomes no Boss Only acompanham os novos títulos dos cards:
--    a versão nova (v2) passa a ser "Prioridades e Urgências" e a v1 vira
--    "Prioridades e Urgências (versão antiga)". Só muda o texto exibido; os
--    códigos e as liberações já dadas continuam os mesmos.
--
-- Nenhuma tabela ou função é alterada. Pode ser rodada mais de uma vez.

INSERT INTO public.permissoes_objetos (codigo, nome, descricao, categoria, origem)
VALUES (
  'home.card.atende_stack',
  'Home — Atende Stack',
  'Card Atende Stack (perguntas e respostas da operação) na Home.',
  'home',
  'src/pages/Home.tsx'
)
ON CONFLICT (codigo) DO NOTHING;

-- Só copia quando o card ainda não tem nenhuma liberação (primeira execução),
-- para não desfazer depois o que o Boss Only tiver retirado.
INSERT INTO public.permissoes_grants (objeto_codigo, target_type, target_id)
SELECT 'home.card.atende_stack', g.target_type, g.target_id
FROM public.permissoes_grants g
WHERE g.objeto_codigo = 'home.card.escala'
  AND g.target_type IN ('role', 'equipe')
  AND NOT EXISTS (SELECT 1 FROM public.permissoes_grants x WHERE x.objeto_codigo = 'home.card.atende_stack')
ON CONFLICT DO NOTHING;

UPDATE public.permissoes_objetos
SET nome = 'Home — Prioridades e Urgências',
    descricao = 'Card do app Prioridades e Urgências (versão atual, com o visual novo).',
    updated_at = now()
WHERE codigo = 'home.card.prioridades_urgencias_v2';

UPDATE public.permissoes_objetos
SET nome = 'Home — Prioridades e Urgências (versão antiga)',
    descricao = 'Card da versão antiga do app Prioridades e Urgências, mantida como reserva.',
    updated_at = now()
WHERE codigo = 'home.card.prioridades_urgencias';
