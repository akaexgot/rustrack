/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly BATTLEMETRICS_API_KEY?: string;
  readonly PUBLIC_APP_URL?: string;
  readonly PUBLIC_DEFAULT_LOCALE?: 'es' | 'en';
  readonly PUBLIC_ENABLE_MOCK_BATTLEMETRICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
