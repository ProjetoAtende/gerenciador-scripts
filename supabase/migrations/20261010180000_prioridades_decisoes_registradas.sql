-- App "Prioridades e Urgências" — registro de duas decisões de projeto.
--
-- Esta migration NÃO altera o schema. Ela existe para deixar as decisões
-- registradas no histórico versionado, junto do banco, em vez de só em
-- comentário de código ou de conversa. A migration 20261010140000 já foi
-- aplicada no remoto e por isso não é reescrita.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- DECISÃO 1 — o papel `admin` global do Gerenciador tem LEITURA TOTAL
-- ─────────────────────────────────────────────────────────────────────────
--
-- A especificação (RF-GER-02, slides 113 e 115) define visibilidade restrita:
-- a anotação é visível ao Atendente criador, ao Gestor/Conferente responsável
-- e à UPJ destinatária. Não prevê exceção.
--
-- A implementação em public.prioridades_pode_ver retorna TRUE de imediato para
-- quem tem role = 'admin' em public.users, ou seja, o admin enxerga anotações
-- de qualquer atendente e de qualquer UPJ, ignorando o isolamento.
--
-- DESVIO ACEITO EXPLICITAMENTE pela área, com duas razões:
--   1. Consistência com o restante do Gerenciador — public.tem_permissao também
--      concede tudo ao admin, e o módulo "Boss Only" existe para suporte.
--   2. Capacidade de dar suporte a um caso travado sem acesso ao banco.
--
-- CONSEQUÊNCIA ASSUMIDA: a promessa central do sistema ("fim da exposição do
-- nome do Atendente às correções", seção 2.2) vale para todos os perfis EXCETO
-- admin. Como a anotação pode conter dado sensível de saúde (tipo "Tratamento
-- médico / Fornecimento de medicamento"), a leitura por admin deve ser tratada
-- como acesso privilegiado e excepcional, não como rotina.
--
-- A ESCRITA continua restrita: prioridades_pode_editar não concede nada ao
-- admin, então ele não altera anotação alheia fora do fluxo (RF-GER-03).
--
-- [AÇÃO SUGERIDA] Se a STI exigir auditabilidade desse acesso, o caminho é
-- alimentar o log de acessos (RF-GER-05, schema ainda a definir na
-- especificação) com as leituras feitas por admin.

COMMENT ON FUNCTION public.prioridades_pode_ver(bigint) IS
  'RF-GER-02. Visibilidade restrita: criador, gestor/conferente vinculado, ou usuários da UPJ de destino. DESVIO REGISTRADO: retorna TRUE de imediato para role = admin (leitura total para suporte) — ver migration 20261010180000_prioridades_decisoes_registradas.sql.';

COMMENT ON FUNCTION public.prioridades_pode_editar(bigint) IS
  'RF-GER-03. Não há exclusão. A alteração só é permitida a quem está na vez: criador (quando devolvida), gestor/conferente (em Ag. Conferência) ou UPJ na pendente. O admin NÃO recebe bypass de escrita.';

-- ─────────────────────────────────────────────────────────────────────────
-- DECISÃO 2 — Eproc/SAJ é campo do formulário, não retorno da API
-- ─────────────────────────────────────────────────────────────────────────
--
-- RF-ATD-03 pedia exibir os indicadores de UPJ, Vara e Sistema, com o sistema
-- vindo da consulta à API. O DJEN não informa em que sistema o processo
-- tramita, e o número CNJ não carrega essa informação.
--
-- DECISÃO: o campo passou a ser seleção OPCIONAL no formulário, preenchida pelo
-- atendente. Não bloqueia o envio (RF-ATD-11 não o exige). A coluna
-- prioridades_anotacoes.plataforma continua com o CHECK ('eproc' | 'saj') e
-- aceita NULL.
--
-- Isso encerra a lacuna apontada no parecer técnico: o DJEN fornece apenas o
-- que é capaz de fornecer.

COMMENT ON COLUMN public.prioridades_anotacoes.plataforma IS
  'Sistema processual (eproc | saj). DECISÃO: informado opcionalmente pelo atendente no formulário — o DJEN não é capaz de fornecer este dado. Nullable.';

COMMIT;
