import { publicEnv } from '@/lib/config/env';
import { isLocale, type Locale } from '@/lib/i18n/dictionaries';

export function getLocaleFromParams(lang: string | undefined): Locale {
  if (isLocale(lang)) return lang;
  return publicEnv.defaultLocale;
}

export function localizedPath(locale: Locale, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalizedPath}`;
}
