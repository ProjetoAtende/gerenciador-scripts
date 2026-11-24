import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { consultarDatajud, consultarDjen } from '../_shared/fontes.ts';
import {
  interpretarNumero,
  resolver,
  type NumeroCnj,
  type ResultadoLocalizacao,
} from '../_shared/localizador.ts';

/**
 * prioridades-localizar — onde está o processo (Datajud + DJEN), para a Nova Anotação da v2.
 *
 * POST { processo, modo }
 *   modo 'rapido'   : só a DJEN (~0,3 s). A tela mostra isso primeiro.
 *   modo 'completo' : DJEN + Datajud. O Datajud é lento (24 s a 2 min), então a tela
 *                     chama este modo em segundo plano, só quando a Vara ainda é desconhecida.
 *   modo 'completar': { anotacao_id } — para anotação JÁ ENVIADA sem Vara. Responde na hora
 *                     (202) e termina sozinho em segundo plano (EdgeRuntime.waitUntil),
 *                     gravando a Vara pela RPC `prioridades_v2_completar_vara`, que só aceita
 *                     o criador da anotação e só preenche Vara vazia.
 *
 * Segurança: exige sessão de usuário (como o djen-proxy). A chave do Datajud fica no secret
 * DATAJUD_API_KEY e nunca vai ao navegador. O Datajud não envia CORS, então nem daria para
 * chamá-lo do navegador.
 *
 * Economia da chave (compartilhada com o chatbot): o Datajud não é consultado quando a DJEN
 * já mostra o processo fora do Foro Central ou já informa a Vara.
 */

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsPara(req: Request): Record<string, string> {
  const base = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.length === 0) return { ...base, 'Access-Control-Allow-Origin': '*' };
  const origem = req.headers.get('Origin') ?? '';
  return { ...base, 'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origem) ? origem : 'null' };
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** O Datajud só acrescenta algo quando a Vara ainda é desconhecida e o processo não está claramente fora. */
const precisaDatajud = (r: ResultadoLocalizacao) => r.vara === null && r.escopo.situacao !== 'fora';

async function localizar(numero: NumeroCnj, modo: 'rapido' | 'completo'): Promise<ResultadoLocalizacao> {
  const djen = await consultarDjen(numero.digitos);
  const rapido = resolver({ numero, djen, datajud: null });
  if (modo === 'rapido') return rapido;
  if (!precisaDatajud(rapido)) return resolver({ numero, djen, datajud: { status: 'dispensado' } });
  return resolver({ numero, djen, datajud: await consultarDatajud(numero.digitos, Deno.env.get('DATAJUD_API_KEY') ?? '') });
}

// ── Servidor ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = corsPara(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405, cors);

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json({ erro: 'Sessão ausente.' }, 401, cors);

  // Cliente "vestido" com a sessão do usuário: as RPCs enxergam auth.uid() dele.
  const cliente = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: usuario, error: erroUsuario } = await cliente.auth.getUser(token);
  if (erroUsuario || !usuario?.user) return json({ erro: 'Sessão inválida ou expirada.' }, 401, cors);

  try {
    const corpo = (await req.json().catch(() => ({}))) as { processo?: unknown; modo?: unknown; anotacao_id?: unknown };
    const modo = corpo.modo === 'completo' || corpo.modo === 'completar' ? corpo.modo : 'rapido';

    if (modo === 'completar') {
      const anotacaoId = Number(corpo.anotacao_id);
      if (!Number.isInteger(anotacaoId) || anotacaoId <= 0) return json({ erro: 'Informe anotacao_id.' }, 400, cors);

      const { data: anotacao, error } = await cliente
        .from('prioridades_anotacoes')
        .select('id, processo, vara, plataforma, criador_id')
        .eq('id', anotacaoId)
        .maybeSingle();
      if (error || !anotacao) return json({ erro: 'Anotação não encontrada.' }, 404, cors);
      if (anotacao.criador_id !== usuario.user.id) return json({ erro: 'Só quem criou a anotação pode completá-la.' }, 403, cors);
      if (anotacao.vara !== null && anotacao.plataforma !== null) return json({ ok: true, nada_a_fazer: true }, 200, cors);

      const numero = interpretarNumero(anotacao.processo);
      if (!numero.ok) return json({ erro: numero.mensagem }, 400, cors);

      const tarefa = (async () => {
        const r = await localizar(numero, 'completo');
        if (r.vara === null && r.sistema.valor === null) return;
        const { error: erroRpc } = await cliente.rpc('prioridades_v2_completar_vara', {
          p_anotacao_id: anotacaoId,
          p_vara: r.vara,
          p_vara_fonte: r.varaFonte,
          p_plataforma: r.sistema.valor,
        });
        if (erroRpc) console.error('[prioridades-localizar] completar:', erroRpc.message);
      })();

      if (typeof EdgeRuntime !== 'undefined') {
        EdgeRuntime.waitUntil(tarefa);
        return json({ ok: true, em_andamento: true }, 202, cors);
      }
      await tarefa;
      return json({ ok: true }, 200, cors);
    }

    const numero = interpretarNumero(corpo.processo);
    if (!numero.ok) return json({ erro: numero.mensagem }, 400, cors);
    return json(await localizar(numero, modo), 200, cors);
  } catch (e) {
    console.error('[prioridades-localizar]', e);
    return json({ erro: 'Falha inesperada ao localizar o processo.' }, 500, cors);
  }
});
