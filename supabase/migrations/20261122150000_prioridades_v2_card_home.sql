-- Prioridades e Urgências — VERSÃO NOVA (v2), em teste.
--
-- Registra o código de permissão do card "Prioridades e Urgências (nova versão)"
-- na Home. A v2 usa as MESMAS tabelas e funções da v1; muda só a interface.
--
-- Somente acréscimo: nenhuma tabela, função ou permissão da v1 é alterada, e o
-- card NÃO é liberado para ninguém aqui. Os testadores recebem a permissão pelo
-- Boss Only (grant por usuário). O admin vê todos os cards por padrão.

INSERT INTO public.permissoes_objetos (codigo, nome, descricao, categoria, origem)
VALUES (
  'home.card.prioridades_urgencias_v2',
  'Home — Prioridades e Urgências (nova versão)',
  'Card de acesso à versão nova (em teste) do app de Prioridades e Urgências. A versão atual continua no card de sempre.',
  'home',
  'src/pages/Home.tsx'
)
ON CONFLICT (codigo) DO UPDATE
SET nome = excluded.nome,
    descricao = excluded.descricao,
    categoria = excluded.categoria,
    origem = excluded.origem,
    updated_at = now();
