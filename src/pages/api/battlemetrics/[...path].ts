import type { APIRoute } from 'astro';

const apiBaseUrl = 'https://api.battlemetrics.com';
const cache = new Map<string, { expiresAt: number; body: string; status: number }>();
const hits = new Map<string, { count: number; resetAt: number }>();
const cacheTtlMs = 45_000;
const rateWindowMs = 10_000;
const maxHitsPerWindow = 45;

export const GET: APIRoute = async ({ request, params, clientAddress }) => {
  const path = params.path;
  if (!path || !isAllowedPath(path)) {
    return json({ error: 'battlemetrics_path_not_allowed' }, 404);
  }

  const requester = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (!consumeRateLimit(requester)) {
    return json({ error: 'rate_limited' }, 429, {
      'Cache-Control': 'no-store',
    });
  }

  const url = new URL(request.url);
  const targetPath = `/${path}${url.search}`;
  const cached = cache.get(targetPath);

  if (cached && cached.expiresAt > Date.now()) {
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=90',
        'X-Rustrack-Cache': 'hit',
      },
    });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Rustrack/0.1 (+https://rustrack.app)',
  };

  if (import.meta.env.BATTLEMETRICS_API_KEY) {
    headers.Authorization = `Bearer ${import.meta.env.BATTLEMETRICS_API_KEY}`;
  }

  const response = await fetch(`${apiBaseUrl}${targetPath}`, { headers });
  const body = await response.text();

  if (response.ok) {
    cache.set(targetPath, {
      body,
      status: response.status,
      expiresAt: Date.now() + cacheTtlMs,
    });
  }

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': response.ok ? 'public, max-age=30, stale-while-revalidate=90' : 'no-store',
      'X-Rustrack-Cache': 'miss',
    },
  });
};

function isAllowedPath(path: string) {
  return path === 'servers' || /^servers\/[a-zA-Z0-9_-]+$/.test(path);
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  const current = hits.get(key);

  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + rateWindowMs });
    return true;
  }

  if (current.count >= maxHitsPerWindow) return false;
  current.count += 1;
  return true;
}

function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
