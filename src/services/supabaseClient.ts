import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required but not defined');
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required but not defined');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 50
    }
  }
});
