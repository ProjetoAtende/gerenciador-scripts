/** Service role só em Node/scripts — nunca prefixo VITE_ (Vite embute no browser). */
export function readSupabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
}

export const SERVICE_ROLE_ENV_HINT =
  'Defina SUPABASE_SERVICE_ROLE_KEY no .env (não use VITE_ no frontend).';
