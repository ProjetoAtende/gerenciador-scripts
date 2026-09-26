-- Cards da Home — recorte Gerenciador Atende (sem Distribuidor/Oráculo/etc.)

INSERT INTO public.permissoes_objetos (codigo, nome, descricao, categoria, origem)
VALUES
  ('home.card.escala', 'Home — Escala', 'Card Escala na Home.', 'home', 'src/pages/Home.tsx'),
  ('home.card.pasquale', 'Home — Pasquale', 'Card Pasquale na Home.', 'home', 'src/pages/Home.tsx'),
  ('home.card.scripts', 'Home — Scripts', 'Card Scripts na Home.', 'home', 'src/pages/Home.tsx'),
  ('home.card.links_uteis', 'Home — Links Úteis', 'Card Links Úteis na Home.', 'home', 'src/pages/Home.tsx'),
  ('home.card.outros_servicos', 'Home — Outros Serviços', 'Card direto de Outros Serviços na Home.', 'home', 'src/pages/Home.tsx'),
  ('home.card.configuracoes', 'Home — Configurações', 'Acesso ao modal de configurações do usuário.', 'home', 'src/pages/Home.tsx'),
  ('scripts.curadoria_acesso', 'Curadoria de Scripts', 'Controles de curadoria de scripts.', 'scripts', 'src/hooks/useScriptsModal.ts'),
  ('scripts.n1_controles', 'Controles N1 (Scripts)', 'Filtros e ações N1 nos scripts.', 'scripts', 'src/hooks/useScriptsModal.ts'),
  ('scripts.aprovar_exclusao', 'Aprovar exclusão de scripts', 'Fluxo de exclusão pendente.', 'scripts', 'src/services/notificacaoExclusaoService.ts')
ON CONFLICT (codigo) DO UPDATE
SET nome = excluded.nome,
    descricao = excluded.descricao,
    categoria = excluded.categoria,
    origem = excluded.origem,
    updated_at = now();

INSERT INTO public.permissoes_grants (objeto_codigo, target_type, target_id)
VALUES
  ('home.card.escala', 'role', 'user'),
  ('home.card.escala', 'role', 'supervisor'),
  ('home.card.escala', 'role', 'coordenador'),
  ('home.card.pasquale', 'role', 'user'),
  ('home.card.pasquale', 'role', 'supervisor'),
  ('home.card.pasquale', 'role', 'coordenador'),
  ('home.card.scripts', 'role', 'user'),
  ('home.card.scripts', 'role', 'supervisor'),
  ('home.card.scripts', 'role', 'coordenador'),
  ('home.card.links_uteis', 'role', 'user'),
  ('home.card.links_uteis', 'role', 'supervisor'),
  ('home.card.links_uteis', 'role', 'coordenador'),
  ('home.card.outros_servicos', 'role', 'user'),
  ('home.card.outros_servicos', 'role', 'supervisor'),
  ('home.card.outros_servicos', 'role', 'coordenador'),
  ('home.card.configuracoes', 'role', 'user'),
  ('home.card.configuracoes', 'role', 'supervisor'),
  ('home.card.configuracoes', 'role', 'coordenador'),
  ('scripts.curadoria_acesso', 'role', 'supervisor'),
  ('scripts.curadoria_acesso', 'role', 'coordenador'),
  ('scripts.n1_controles', 'role', 'supervisor'),
  ('scripts.aprovar_exclusao', 'role', 'supervisor')
ON CONFLICT (objeto_codigo, target_type, target_id) DO NOTHING;

INSERT INTO public.permissoes_grants (objeto_codigo, target_type, target_id)
SELECT 'admin.boss_only_modal', 'role', r
FROM (VALUES ('supervisor'), ('coordenador')) AS t(r)
ON CONFLICT DO NOTHING;
