import { useMemo, useState } from 'react';
import { Calendar, Clock3, HelpCircle, Landmark, ShieldCheck, Users, X } from 'lucide-react';
import BaseAnimatedModal from '../BaseAnimatedModal';

interface EscalaHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SecaoAjuda =
  | 'visao-geral'
  | 'calendarios'
  | 'leitura'
  | 'dias'
  | 'rotinas'
  | 'afastamentos'
  | 'turnos'
  | 'institucional'
  | 'historico';

const secoes: Array<{
  id: SecaoAjuda;
  titulo: string;
  resumo: string;
  icone: typeof Calendar;
}> = [
  { id: 'visao-geral', titulo: 'Visão Geral', resumo: 'O que é a Escala e quem compartilha o calendário.', icone: Calendar },
  { id: 'calendarios', titulo: 'Calendários', resumo: 'Criação, desativação e reativação de calendários.', icone: Calendar },
  { id: 'leitura', titulo: 'Como Ler', resumo: 'Entenda P, E, A e por que o mês é enxuto.', icone: ShieldCheck },
  { id: 'dias', titulo: 'Detalhe do Dia', resumo: 'Veja quem está presencial, extraordinário ou afastado.', icone: Users },
  { id: 'rotinas', titulo: 'Rotinas', resumo: 'Repita presenciais por dia da semana dentro de um período.', icone: Calendar },
  { id: 'afastamentos', titulo: 'Afastamentos', resumo: 'Como funcionam férias, licença e folga.', icone: Clock3 },
  { id: 'turnos', titulo: 'Turnos', resumo: 'Onde os turnos ficam configurados.', icone: Users },
  { id: 'institucional', titulo: 'Agenda Global', resumo: 'Feriados, emendas e recesso judiciário.', icone: Landmark },
  { id: 'historico', titulo: 'Histórico', resumo: 'Como auditar mudanças sem poluir a tela.', icone: HelpCircle },
];

function renderContent(secao: SecaoAjuda) {
  switch (secao) {
    case 'visao-geral':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            A Escala organiza o trabalho presencial em dias úteis, o serviço extraordinário no fim de semana,
            os afastamentos e a agenda institucional do TJSP em um único calendário.
          </p>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-950/20">
            <p className="text-sm text-sky-900 dark:text-sky-100/90">
              Algumas equipes possuem calendário exclusivo. As equipes <strong>2.3.1</strong> e <strong>2.3.2</strong>
              compartilham o mesmo calendário, então qualquer membro dessas equipes vê e edita a mesma escala.
            </p>
          </div>
        </div>
      );
    case 'calendarios':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Cada equipe usa um calendário ativo por vez. As equipes <strong>2.3.1</strong> e <strong>2.3.2</strong>
            compartilham o mesmo calendário ativo.
          </p>
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ciclo de vida</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Qualquer usuário pode criar um novo calendário quando a equipe estiver sem calendário ativo.</li>
              <li>O botão <strong>Desativar</strong> oculta o calendário atual e os registros próprios dele, sem apagar fisicamente o histórico.</li>
              <li>A <strong>Agenda Institucional</strong> continua global e não é perdida quando um calendário é desativado.</li>
              <li>Quando não houver calendário ativo, a tela passa a oferecer <strong>Criar novo calendário</strong> e <strong>Reativar calendário antigo</strong>.</li>
              <li>A reativação só funciona se não existir outro calendário ativo para aquela equipe ou grupo compartilhado.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-500/20 dark:bg-cyan-950/20">
            <p className="text-sm text-cyan-900 dark:text-cyan-100/90">
              No uso diário, o sistema mostra apenas o nome padrão do calendário. Na lista de reativação, aparece o nome técnico salvo no banco para ajudar a diferenciar calendários antigos.
            </p>
          </div>
        </div>
      );
    case 'leitura':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            O mês mostra só o essencial para não poluir a tela: contadores do dia e, quando houver registro para você,
            um marcador com o seu próprio nome ou situação.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">P</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Quantidade de presenciais no dia.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">E</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Quantidade de extraordinários no dia.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">A</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Quantidade de afastamentos no dia.</p>
            </div>
          </div>
        </div>
      );
    case 'dias':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Ao clicar em um dia, o sistema abre o detalhe completo com os nomes de todas as pessoas escaladas ou afastadas.
          </p>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>De segunda a sexta comuns: presencial e afastamentos.</li>
            <li>Sábados, domingos e dias com agenda institucional: apenas extraordinário no serviço do dia.</li>
            <li>Você também verá os turnos configurados dos membros no detalhe do dia.</li>
            <li>A aba <strong>Visualizar</strong> serve para consulta. A aba <strong>Editar</strong> serve para lançar ou remover serviço do dia.</li>
            <li>Em dia útil comum, o lançamento permitido é <strong>presencial</strong>.</li>
            <li>Em fim de semana ou em dia de agenda institucional, o lançamento permitido é <strong>extraordinário</strong>.</li>
            <li>Quando um nome vier de uma rotina semanal, isso aparecerá identificado no detalhe do dia.</li>
            <li>Nesses casos, você pode criar uma <strong>exceção do dia</strong>: retirar a pessoa só daquela data ou já retirá-la e lançá-la em outra.</li>
          </ul>
        </div>
      );
    case 'rotinas':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            A aba <strong>Rotinas</strong> foi criada para evitar preenchimento repetitivo semana a semana.
            Nela você pode marcar, por exemplo, que uma pessoa ficará presencial em <strong>todas as terças-feiras</strong>
            dentro de um período.
          </p>
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Como funciona</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Escolha o usuário.</li>
              <li>Escolha o dia da semana entre segunda e sexta.</li>
              <li>Informe a data inicial. A data final é opcional.</li>
              <li>O calendário passa a considerar automaticamente todas as ocorrências daquele dia da semana no período.</li>
              <li>Se uma terça específica fugir da regra, faça o ajuste no detalhe do dia usando a exceção da rotina.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-500/20 dark:bg-cyan-950/20">
            <p className="text-sm text-cyan-900 dark:text-cyan-100/90">
              Se a data final ficar em branco, a rotina segue valendo até ser removida. Ajustes pontuais continuam sendo feitos no detalhe do dia. Já a manutenção da repetição fica centralizada na aba de rotinas.
            </p>
          </div>
        </div>
      );
    case 'afastamentos':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Férias, licença e folga sempre são registradas com <strong>data de início</strong> e <strong>data de fim</strong>.
            Se as duas datas forem iguais, o afastamento vale por um único dia.
          </p>
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Como usar a aba</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li><strong>Cadastrar</strong>: cria um novo afastamento.</li>
              <li><strong>Registros</strong>: mostra o resumo e a listagem com filtros.</li>
              <li>Os filtros atuais permitem pesquisar por <strong>equipe</strong>, <strong>usuário</strong>, <strong>tipo</strong> e <strong>período</strong>.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
            <p className="text-sm text-amber-900 dark:text-amber-100/90">
              O sistema bloqueia conflito de afastamento com <strong>lançamentos manuais</strong> de presencial ou extraordinário no mesmo dia. Rotinas semanais continuam existindo como regra geral e deixam de aparecer no calendário quando o dia estiver coberto por afastamento.
            </p>
          </div>
        </div>
      );
    case 'turnos':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Cada membro do calendário tem um turno padrão configurado na aba <strong>Membros</strong>.
          </p>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li><strong>09 às 17</strong></li>
            <li><strong>11 às 19</strong></li>
          </ul>
        </div>
      );
    case 'institucional':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Feriados, emendas e recesso judiciário ficam em uma agenda global e aparecem para todos os calendários.
          </p>
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Como usar a aba</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li><strong>Cadastrar</strong>: cria feriado, emenda ou recesso.</li>
              <li><strong>Registros</strong>: mostra resumo e listagem com filtros por <strong>tipo</strong> e <strong>período</strong>.</li>
              <li>Os eventos podem ser <strong>editados</strong> ou removidos diretamente nessa listagem.</li>
              <li>Os eventos dessa agenda valem para <strong>todos os calendários</strong> da Escala.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-950/20">
            <p className="text-sm text-indigo-900 dark:text-indigo-100/90">
              Em dias com agenda institucional, a rotina semanal de presencial não é aplicada. Nesses dias, só faz sentido lançar <strong>extraordinário</strong>.
            </p>
          </div>
        </div>
      );
    case 'historico':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            O cabeçalho mostra apenas a última alteração para manter a tela limpa. O detalhamento completo fica em histórico sob demanda.
          </p>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Use o botão <strong>Histórico</strong> para verificar quem alterou a escala, quando a alteração aconteceu e em qual parte do calendário ela ocorreu.
          </p>
        </div>
      );
  }
}

export function EscalaHelperModal({ isOpen, onClose }: EscalaHelperModalProps) {
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoAjuda>('visao-geral');
  const secaoAtual = useMemo(() => secoes.find((item) => item.id === secaoAtiva) ?? secoes[0], [secaoAtiva]);

  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      zIndex="z-[10020]"
      contentClassName="relative flex h-[min(90vh,840px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Guia da Escala</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Entenda a tela, os contadores e as regras da escala.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full border-b border-gray-200 bg-cyan-50/70 p-4 dark:border-gray-700 dark:bg-cyan-950/10 md:w-80 md:border-b-0 md:border-r">
          <div className="grid gap-2 md:block">
            {secoes.map(({ id, titulo, resumo, icone: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSecaoAtiva(id)}
                className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  secaoAtiva === id
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-gray-700 hover:bg-white/80 dark:text-gray-200 dark:hover:bg-gray-900/60'
                }`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{titulo}</span>
                  <span className={`mt-1 block text-xs leading-relaxed ${secaoAtiva === id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                    {resumo}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{secaoAtual.titulo}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{secaoAtual.resumo}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {renderContent(secaoAtiva)}
          </div>
        </div>
      </div>
    </BaseAnimatedModal>
  );
}

export default EscalaHelperModal;
