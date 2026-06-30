import { z } from 'zod';

const publicEnvSchema = z.object({
  supabaseUrl: z.url().optional(),
  supabaseAnonKey: z.string().min(1).optional(),
  appUrl: z.url().default('http://localhost:4321'),
  defaultLocale: z.enum(['es', 'en']).default('es'),
  enableMockBattlemetrics: z.boolean().default(true),
});

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true';
}

export const publicEnv = publicEnvSchema.parse({
  supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  appUrl: import.meta.env.PUBLIC_APP_URL,
  defaultLocale: import.meta.env.PUBLIC_DEFAULT_LOCALE,
  enableMockBattlemetrics: readBoolean(import.meta.env.PUBLIC_ENABLE_MOCK_BATTLEMETRICS, true),
});

export const hasSupabaseConfig = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
