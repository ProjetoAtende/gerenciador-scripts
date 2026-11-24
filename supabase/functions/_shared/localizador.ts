/**
 * Localizador de processos (Datajud + DJEN): regras puras, sem rede.
 *
 * Portado do protótipo `chatbot/prioridades/prototipo-validacao/src/` (cnj, orgao, upjs,
 * resolver) para a Edge Function `prioridades-localizar`. Este arquivo não usa nada do
 * Deno nem do navegador: a Edge Function o importa e os testes do Vitest também
 * (`src/services/__tests__/localizador.test.ts`).
 *
 * Diferença em relação ao protótipo (decisão do Celso, etapa 2 da v2, 22/11/2026):
 * a COMPETÊNCIA passa a ser decidida pelo órgão onde o processo está HOJE (publicação
 * mais recente de 1.º grau na DJEN ou, sem ela, o Datajud), e não pelo final do número.
 * Assim:
 *   - 4189868-12.2026.8.26.0100: final 0100, mas hoje em Santo Amaro  → fora;
 *   - 4000525-51.2026.8.26.0373: final 0373, mas hoje na UPJ IX        → dentro.
 * O final 0100 só decide quando nenhuma fonte sabe onde o processo está.
 */

// ── Número CNJ ──────────────────────────────────────────────────────────────

export interface NumeroCnj {
  ok: true;
  /** NNNNNNN-DD.AAAA.J.TR.OOOO */
  numero: string;
  /** 20 dígitos */
  digitos: string;
  origem: string;
  /** Completado com 8.26.0100 a partir do número até o ano. */
  completado: boolean;
}

export type NumeroCnjInvalido = { ok: false; mensagem: string };

const SUFIXO_FORO_CENTRAL = '8260100';

export function calcularDvCnj(semDv: { sequencial: string; ano: string; j: string; tr: string; origem: string }): string {
  const base = BigInt(`${semDv.sequencial}${semDv.ano}${semDv.j}${semDv.tr}${semDv.origem}00`);
  return String(98n - (base % 97n)).padStart(2, '0');
}

export function formatarCnj(d: string): string {
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

/** Aceita número formatado, 20 dígitos ou "até o ano" (13 dígitos, completa com 8.26.0100). */
export function interpretarNumero(entrada: unknown): NumeroCnj | NumeroCnjInvalido {
  let d = String(entrada ?? '').replace(/\D/g, '');
  if (!d) return { ok: false, mensagem: 'Informe o número do processo.' };

  let completado = false;
  if (d.length === 13) {
    d = `${d}${SUFIXO_FORO_CENTRAL}`;
    completado = true;
  }
  if (d.length !== 20) {
    return { ok: false, mensagem: 'Número incompleto: informe os 20 dígitos do padrão CNJ ou até o ano.' };
  }

  const partes = {
    sequencial: d.slice(0, 7),
    dv: d.slice(7, 9),
    ano: d.slice(9, 13),
    j: d.slice(13, 14),
    tr: d.slice(14, 16),
    origem: d.slice(16, 20),
  };
  if (partes.j !== '8' || partes.tr !== '26') {
    return { ok: false, mensagem: 'Este número não é de um processo do TJSP (deveria conter 8.26).' };
  }
  if (calcularDvCnj(partes) !== partes.dv) {
    return {
      ok: false,
      mensagem: completado
        ? 'O dígito verificador não confere com o final 8.26.0100. Informe o número completo.'
        : 'O dígito verificador não confere: provavelmente há um erro de digitação no número.',
    };
  }
  return { ok: true, numero: formatarCnj(d), digitos: d, origem: partes.origem, completado };
}

// ── UPJs do Foro Central (1.ª a 45.ª Varas Cíveis) ─────────────────────────

export interface UpjCentral {
  numeral: string;
  inicio: number;
  fim: number;
  /** Código da UPJ no banco (`prioridades_upjs.codigo`), ex.: FCC-11-15. */
  codigo: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const upj = (numeral: string, inicio: number, fim: number): UpjCentral => ({
  numeral,
  inicio,
  fim,
  codigo: `FCC-${pad(inicio)}-${pad(fim)}`,
});

/** A numeração romana não acompanha a ordem das Varas. Fonte: cumprimento/base/lista_unidades.csv */
export const UPJS_CENTRAL: readonly UpjCentral[] = [
  upj('VI', 1, 5),
  upj('VIII', 6, 10),
  upj('IX', 11, 15),
  upj('V', 16, 20),
  upj('III', 21, 25),
  upj('II', 26, 30),
  upj('IV', 31, 35),
  upj('VII', 36, 40),
  upj('I', 41, 45),
];

export const VARA_MIN = 1;
export const VARA_MAX = 45;

export const upjDaVara = (vara: number) => UPJS_CENTRAL.find((u) => vara >= u.inicio && vara <= u.fim) ?? null;
export const upjDaFaixa = (inicio: number, fim: number) =>
  UPJS_CENTRAL.find((u) => u.inicio === inicio && u.fim === fim) ?? null;
export const varasDaUpj = (u: UpjCentral) => Array.from({ length: u.fim - u.inicio + 1 }, (_, i) => u.inicio + i);

// ── Nomes de órgão ──────────────────────────────────────────────────────────
//   Datajud / Eproc : "Juízo Titular I - 30ª Vara Cível - Foro Central Cível"
//   Datajud / SAJ   : "07 CIVEL DE CENTRAL"
//   DJEN  / SAJ     : "Foro Central Cível - 7ª Vara Cível"
//   DJEN  / Eproc   : "UPJ da 41ª a 45ª Varas Cíveis - Foro Central Cível"
// Qualquer outro (Família, Regional, Câmara, Registros Públicos...) é "outro".

export type OrgaoInterpretado =
  | { tipo: 'vara'; vara: number; padronizado: string; original: string }
  | { tipo: 'upj'; inicio: number; fim: number; padronizado: string; original: string }
  | { tipo: 'outro'; original: string }
  | { tipo: 'vazio'; original: string };

const ORDINAL = '(\\d{1,2})\\s*[ªº.]?';
const RE_EPROC_VARA = new RegExp(`${ORDINAL}\\s*Vara\\s+C[ií]vel\\s*-\\s*Foro\\s+Central\\s+C[ií]vel`, 'i');
const RE_DJEN_VARA = new RegExp(`Foro\\s+Central\\s+C[ií]vel\\s*-\\s*${ORDINAL}\\s*Vara\\s+C[ií]vel`, 'i');
const RE_SAJ_VARA = /^\s*0*(\d{1,2})\s+CIVEL\s+DE\s+CENTRAL\s*$/i;
const RE_UPJ = new RegExp(
  `UPJ\\s+da\\s+${ORDINAL}\\s*a\\s*${ORDINAL}\\s*Varas\\s+(?:da\\s+)?C[ií]veis\\s*-\\s*Foro\\s+Central\\s+C[ií]vel`,
  'i',
);
/** Órgãos de 2.º grau: uma publicação deles não diz onde o processo está no 1.º grau. */
const RE_SEGUNDO_GRAU = /c[âa]mara|turma recursal|desembargador|gab\.|gabinete|se[çc][ãa]o de direito|presid[êe]ncia/i;

export const varaPadronizada = (vara: number) => `${vara}ª Vara Cível - Foro Central Cível`;

export function interpretarOrgao(nome: unknown): OrgaoInterpretado {
  const original = String(nome ?? '').trim();
  if (!original) return { tipo: 'vazio', original };

  let m = RE_EPROC_VARA.exec(original) || RE_DJEN_VARA.exec(original) || RE_SAJ_VARA.exec(original);
  if (m) {
    const vara = Number(m[1]);
    if (vara >= VARA_MIN && vara <= VARA_MAX) return { tipo: 'vara', vara, padronizado: varaPadronizada(vara), original };
    return { tipo: 'outro', original };
  }

  m = RE_UPJ.exec(original);
  if (m) {
    const inicio = Number(m[1]);
    const fim = Number(m[2]);
    if (inicio >= VARA_MIN && fim <= VARA_MAX && inicio <= fim && upjDaFaixa(inicio, fim)) {
      return { tipo: 'upj', inicio, fim, padronizado: `UPJ da ${inicio}ª a ${fim}ª Varas Cíveis - Foro Central Cível`, original };
    }
  }
  return { tipo: 'outro', original };
}

export const ehSegundoGrau = (nome: unknown) => RE_SEGUNDO_GRAU.test(String(nome ?? ''));

// ── Fontes ──────────────────────────────────────────────────────────────────

export type StatusFonte = 'ok' | 'vazio' | 'erro' | 'pendente' | 'dispensado';

export interface ComunicacaoDjen {
  id?: number;
  data_disponibilizacao?: string;
  nomeOrgao?: string;
  idOrgao?: number;
  nomeClasse?: string;
  link?: string | null;
  texto?: string;
}

export interface FonteDjen {
  status: StatusFonte;
  comunicacoes?: ComunicacaoDjen[];
  erro?: string;
  ms?: number;
}

export interface HitDatajud {
  grau?: string;
  sistema?: { nome?: string };
  orgaoJulgador?: { nome?: string };
  classe?: { nome?: string };
  dataAjuizamento?: string;
}

export interface FonteDatajud {
  status: StatusFonte;
  hits?: HitDatajud[];
  erro?: string;
  ms?: number;
}

// ── Resultado ───────────────────────────────────────────────────────────────

export type Plataforma = 'eproc' | 'saj';

export interface Aviso {
  nivel: 'info' | 'atencao';
  texto: string;
}

export interface ResultadoLocalizacao {
  numero: string;
  digitos: string;
  completado: boolean;
  /**
   * completo       : Datajud respondeu
   * parcial        : só a DJEN respondeu
   * aguardando     : DJEN vazia e Datajud ainda consultando
   * nao_localizado : nenhuma das duas conhece o processo
   * indisponivel   : as fontes falharam
   */
  nivel: 'completo' | 'parcial' | 'aguardando' | 'nao_localizado' | 'indisponivel';
  aguardandoDatajud: boolean;
  fontes: { datajud: { status: StatusFonte; ms: number | null; erro: string | null }; djen: { status: StatusFonte; ms: number | null; erro: string | null } };
  sistema: { valor: Plataforma | null; origem: string | null };
  /** Órgão onde o processo está hoje (o que decide a competência). */
  orgao: { original: string; padronizado: string | null; tipo: OrgaoInterpretado['tipo'] } | null;
  vara: number | null;
  varaFonte: 'datajud' | 'djen' | null;
  /** Quando só a UPJ é conhecida: as Varas dela, para o Atendente escolher (opcional). */
  varasPossiveis: number[] | null;
  upj: UpjCentral | null;
  escopo: { situacao: 'dentro' | 'fora' | 'indeterminado'; motivo: string };
  conteudoRestrito: boolean;
  classe: string | null;
  /** Da publicação de 1.º grau mais recente da DJEN (gravados na anotação). */
  idOrgaoDjen: number | null;
  nomeOrgaoDjen: string | null;
  ultimaPublicacao: string | null;
  avisos: Aviso[];
}

const SISTEMA_DATAJUD: Record<string, Plataforma> = { Projudi: 'eproc', Eproc: 'eproc', SAJ: 'saj' };

export function sistemaPeloLink(link: unknown): Plataforma | null {
  const s = String(link ?? '');
  if (/eproc\w*\.tjsp\.jus\.br/i.test(s)) return 'eproc';
  if (/dje\.tjsp\.jus\.br|esaj\.tjsp\.jus\.br/i.test(s)) return 'saj';
  return null;
}

const semHtml = (t: unknown) => String(t ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function ordenarComunicacoes(lista: ComunicacaoDjen[] = []): ComunicacaoDjen[] {
  return [...lista].sort(
    (a, b) =>
      String(b.data_disponibilizacao ?? '').localeCompare(String(a.data_disponibilizacao ?? '')) || (b.id ?? 0) - (a.id ?? 0),
  );
}

const NOME_PLATAFORMA: Record<Plataforma, string> = { eproc: 'Eproc', saj: 'SAJ' };
const resumoFonte = (f: { status: StatusFonte; ms?: number; erro?: string }) => ({
  status: f.status,
  ms: f.ms ?? null,
  erro: f.erro ?? null,
});

export function resolver(params: { numero: NumeroCnj; datajud?: FonteDatajud | null; djen?: FonteDjen | null }): ResultadoLocalizacao {
  const { numero } = params;
  const avisos: Aviso[] = [];
  const aviso = (nivel: Aviso['nivel'], texto: string) => avisos.push({ nivel, texto });

  const dj: FonteDatajud = params.datajud ?? { status: 'pendente' };
  const dn: FonteDjen = params.djen ?? { status: 'pendente' };
  const aguardandoDatajud = dj.status === 'pendente';

  // ── Datajud: prefere o registro de 1.º grau ──
  const hits = dj.status === 'ok' ? dj.hits ?? [] : [];
  const hit = hits.find((h) => h.grau === 'G1') ?? hits[0] ?? null;
  const orgaoDatajud = hit ? interpretarOrgao(hit.orgaoJulgador?.nome) : null;
  const sistemaDatajud = hit ? SISTEMA_DATAJUD[hit.sistema?.nome ?? ''] ?? null : null;

  // ── DJEN: a publicação de 1.º grau mais recente diz onde o processo está hoje ──
  const comunicacoes = dn.status === 'ok' ? ordenarComunicacoes(dn.comunicacoes) : [];
  const atual = comunicacoes.find((c) => !ehSegundoGrau(c.nomeOrgao)) ?? null;
  const orgaoDjen = atual ? interpretarOrgao(atual.nomeOrgao) : null;
  const comLink = comunicacoes.find((c) => sistemaPeloLink(c.link));
  const sistemaDjenLink = comLink ? sistemaPeloLink(comLink.link) : null;
  const sistemaDjenInferido = !sistemaDjenLink && orgaoDjen?.tipo === 'upj' ? 'eproc' : null;
  const conteudoRestrito = comunicacoes.some((c) => /^processo sigiloso/i.test(semHtml(c.texto).slice(0, 40)));

  let nivel: ResultadoLocalizacao['nivel'];
  if (dj.status === 'ok') nivel = 'completo';
  else if (dn.status === 'ok') nivel = 'parcial';
  else if (dn.status === 'vazio' && aguardandoDatajud) nivel = 'aguardando';
  else if (dn.status === 'vazio' && (dj.status === 'vazio' || dj.status === 'dispensado')) nivel = 'nao_localizado';
  else nivel = 'indisponivel';

  // ── Sistema ──
  let sistema: ResultadoLocalizacao['sistema'] = { valor: null, origem: null };
  if (sistemaDjenLink) sistema = { valor: sistemaDjenLink, origem: 'DJEN (link da publicação mais recente)' };
  else if (sistemaDatajud) sistema = { valor: sistemaDatajud, origem: 'Datajud' };
  else if (sistemaDjenInferido) sistema = { valor: sistemaDjenInferido, origem: 'DJEN (pelo nome da UPJ)' };
  if (sistemaDjenLink && sistemaDatajud && sistemaDjenLink !== sistemaDatajud) {
    aviso(
      'info',
      `O Datajud indica ${NOME_PLATAFORMA[sistemaDatajud]}, mas a publicação mais recente indica ${NOME_PLATAFORMA[sistemaDjenLink]} ` +
        `(o processo deve ter migrado). Prevaleceu ${NOME_PLATAFORMA[sistemaDjenLink]}.`,
    );
  }

  // ── Órgão atual: DJEN (mais fresca) > Datajud ──
  const orgaoAtual: OrgaoInterpretado | null =
    orgaoDjen && orgaoDjen.tipo !== 'vazio' ? orgaoDjen : orgaoDatajud && orgaoDatajud.tipo !== 'vazio' ? orgaoDatajud : null;

  // ── Vara: Datajud quando coerente com a DJEN; senão a Vara da própria DJEN ──
  let vara: number | null = null;
  let varaFonte: ResultadoLocalizacao['varaFonte'] = null;
  const varaDatajud = orgaoDatajud?.tipo === 'vara' ? orgaoDatajud.vara : null;

  if (orgaoAtual?.tipo === 'vara') {
    vara = orgaoAtual.vara;
    varaFonte = orgaoAtual === orgaoDjen ? 'djen' : 'datajud';
    if (varaDatajud && orgaoAtual === orgaoDjen && varaDatajud !== orgaoAtual.vara) {
      aviso('info', `O Datajud aponta a ${varaDatajud}ª Vara, mas a publicação mais recente é da ${orgaoAtual.vara}ª. Prevaleceu a publicação.`);
    }
  } else if (orgaoAtual?.tipo === 'upj' && varaDatajud) {
    if (varaDatajud >= orgaoAtual.inicio && varaDatajud <= orgaoAtual.fim) {
      vara = varaDatajud;
      varaFonte = 'datajud';
    } else {
      aviso(
        'atencao',
        `O Datajud aponta a ${varaDatajud}ª Vara, mas a publicação mais recente é da UPJ das ${orgaoAtual.inicio}ª a ${orgaoAtual.fim}ª Varas. ` +
          'A Vara ficou em aberto.',
      );
    }
  }

  let upjResolvida: UpjCentral | null = null;
  if (vara) upjResolvida = upjDaVara(vara);
  else if (orgaoAtual?.tipo === 'upj') upjResolvida = upjDaFaixa(orgaoAtual.inicio, orgaoAtual.fim);
  const varasPossiveis = !vara && upjResolvida ? varasDaUpj(upjResolvida) : null;

  // ── Competência: onde está hoje > final do número ──
  let escopo: ResultadoLocalizacao['escopo'];
  if (orgaoAtual?.tipo === 'vara' || orgaoAtual?.tipo === 'upj') {
    escopo = { situacao: 'dentro', motivo: 'O processo está hoje numa Vara Cível do Foro Central (1.ª a 45.ª).' };
    if (numero.origem !== '0100') {
      aviso('info', `O número termina em ${numero.origem}, mas o processo está hoje no Foro Central (provavelmente redistribuído).`);
    }
  } else if (orgaoAtual?.tipo === 'outro') {
    escopo = { situacao: 'fora', motivo: `Hoje o processo está em: ${orgaoAtual.original}.` };
  } else if (numero.origem === '0100') {
    escopo = { situacao: 'indeterminado', motivo: 'Nenhuma fonte informou o órgão; o final 0100 indica o Foro Central.' };
  } else {
    escopo = {
      situacao: 'fora',
      motivo: `O número é de outro foro (final ${numero.origem}) e nenhuma fonte mostrou o processo no Foro Central.`,
    };
  }

  // ── Avisos ──
  if (numero.completado) aviso('info', 'Número completado automaticamente com o final 8.26.0100.');
  if (dj.status === 'vazio' && dn.status === 'ok') {
    aviso('info', 'O processo não consta no Datajud (pode ser recente ou sigiloso). Os dados vieram da DJEN.');
  }
  if (dj.status === 'erro' && dj.erro) aviso('atencao', dj.erro);
  if (dn.status === 'erro' && dn.erro) aviso('atencao', dn.erro);
  if (conteudoRestrito) {
    aviso('info', 'Há publicações com conteúdo restrito ("Processo sigiloso"): o processo, ou algum documento, pode estar em segredo de justiça.');
  }

  return {
    numero: numero.numero,
    digitos: numero.digitos,
    completado: numero.completado,
    nivel,
    aguardandoDatajud,
    fontes: { datajud: resumoFonte(dj), djen: resumoFonte(dn) },
    sistema,
    orgao: orgaoAtual
      ? { original: orgaoAtual.original, padronizado: 'padronizado' in orgaoAtual ? orgaoAtual.padronizado : null, tipo: orgaoAtual.tipo }
      : null,
    vara,
    varaFonte,
    varasPossiveis,
    upj: upjResolvida,
    escopo,
    conteudoRestrito,
    classe: hit?.classe?.nome ?? atual?.nomeClasse ?? null,
    idOrgaoDjen: typeof atual?.idOrgao === 'number' ? atual.idOrgao : null,
    nomeOrgaoDjen: atual?.nomeOrgao ?? null,
    ultimaPublicacao: atual?.data_disponibilizacao ?? null,
    avisos,
  };
}
