#!/usr/bin/env node
/**
 * Dispara o worker de tags do Atende Stack (Edge Function ou RPC direta com service role).
 *
 * Env:
 *   VITE_SUPABASE_URL ou SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STACK_TAG_CRON_SECRET (opcional; se setado, chama a Edge Function)
 *   STACK_TAG_WORKER_LIMIT (default 3)
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.STACK_TAG_CRON_SECRET;
const limit = Number(process.env.STACK_TAG_WORKER_LIMIT || '3');

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function viaEdgeFunction() {
  const fnUrl = `${url.replace(/\/$/, '')}/functions/v1/stack-process-tag-jobs?limit=${limit}`;
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'x-stack-cron-secret': cronSecret,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || res.statusText);
  }
  return body;
}

async function viaRpc() {
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('stack_processar_tag_jobs_batch', { p_limit: limit });
  if (error) throw error;
  return data;
}

try {
  const result = cronSecret ? await viaEdgeFunction() : await viaRpc();
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
