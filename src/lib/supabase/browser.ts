import { createClient } from '@supabase/supabase-js';

import { hasSupabaseConfig, publicEnv } from '@/lib/config/env';

export function createBrowserSupabaseClient() {
  if (!hasSupabaseConfig || !publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return null;
  }

  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
