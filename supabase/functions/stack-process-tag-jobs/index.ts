/**
 * Worker HTTP para fila stack_tag_jobs (W1).
 * Invocar via cron (Supabase Dashboard, GitHub Action, etc.) com header x-stack-cron-secret.
 *
 * Secrets: STACK_TAG_CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stack-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const expected = Deno.env.get('STACK_TAG_CRON_SECRET')?.trim();
  const provided = req.headers.get('x-stack-cron-secret')?.trim();

  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get('limit') ?? '3';
  const limit = Math.min(5, Math.max(1, Number.parseInt(limitRaw, 10) || 3));

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('stack_processar_tag_jobs_batch', { p_limit: limit });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
