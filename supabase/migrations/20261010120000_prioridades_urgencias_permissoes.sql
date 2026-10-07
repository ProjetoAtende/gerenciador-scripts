-- App "Prioridades e Urgências" — card de acesso na Home e objetos do módulo.
--
-- A especificação técnica (Especificação Técnica de Requisitos — Aplicativo
-- "Prioridades e Urgências", v1.0, out/2026) descreve três módulos integrados
-- (Atendentes, Gestores, UPJs). Aqui registramos apenas os códigos de permissão;
-- o schema do domínio vive na migration seguinte.

INSERT INTO public.permissoes_objetos (codigo, nome, descricao, categoria, origem)
VALUES
  ('home.card.prioridades_urgencias', 'Home — Prioridades e Urgências',
   'Card de acesso ao app de Prioridades e Urgências na Home.', 'home', 'src/pages/Home.tsx'),
  ('prioridades.modulo_atendente', 'Prioridades — Módulo Atendentes',
   'Registrar anotações, responder devoluções e consultar histórico próprio.',
   'prioridades', 'src/components/prioridades'),
  ('prioridades.modulo_gestor', 'Prioridades — Módulo Gestores',
   'Conferir anotações (aprovar/devolver/rejeitar), marcar Urgentíssimo e designar conferentes.',
   'prioridades', 'src/components/prioridades'),
  ('prioridades.modulo_upj', 'Prioridades — Módulo UPJs',
   'Analisar e resolver anotações da própria UPJ e designar analistas.',
   'prioridades', 'src/components/prioridades'),
  ('prioridades.designacoes', 'Prioridades — Designações',
   'Designar conferentes (Gestor) e analistas (Coordenador da UPJ).',
   'prioridades', 'src/components/prioridades')
ON CONFLICT (codigo) DO UPDATE
SET nome = excluded.nome,
    descricao = excluded.descricao,
    categoria = excluded.categoria,
    origem = excluded.origem,
    updated_at = now();

-- O card fica visível a todos os papéis do Gerenciador; o controle fino de qual
-- módulo cada usuário enxerga é feito pelo perfil do app (tabela
-- prioridades_usuarios_perfil), não pelo papel global do Gerenciador.
INSERT INTO public.permissoes_grants (objeto_codigo, target_type, target_id)
SELECT 'home.card.prioridades_urgencias', 'role', r
FROM (VALUES ('user'), ('supervisor'), ('coordenador')) AS t(r)
ON CONFLICT (objeto_codigo, target_type, target_id) DO NOTHING;
