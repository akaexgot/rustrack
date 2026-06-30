export type BattlemetricsServerAttributes = {
  name?: string;
  ip?: string;
  port?: number;
  players?: number;
  maxPlayers?: number;
  rank?: number;
  status?: string;
  details?: {
    rust_queued_players?: number;
    rust_maps?: {
      name?: string;
      size?: number;
      seed?: number;
    };
    rust_last_wipe?: string;
    rust_next_wipe?: string;
  };
  location?: string[];
};

export type BattlemetricsServerResource = {
  id: string;
  type: 'server';
  attributes: BattlemetricsServerAttributes;
};

export type BattlemetricsListResponse = {
  data: BattlemetricsServerResource[];
};

const apiBaseUrl = 'https://api.battlemetrics.com';

export async function battlemetricsFetch(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get('BATTLEMETRICS_API_KEY');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      body: await response.text(),
    };
  }

  return {
    ok: true as const,
    status: response.status,
    body: await response.json(),
  };
}

export function normalizeServer(resource: BattlemetricsServerResource) {
  const attributes = resource.attributes;
  const location = attributes.location ?? [];
  const map = attributes.details?.rust_maps;

  return {
    id: resource.id,
    name: attributes.name ?? 'Rust server',
    ip: attributes.ip ?? '',
    port: attributes.port ?? 0,
    players: attributes.players ?? 0,
    maxPlayers: attributes.maxPlayers ?? 0,
    queue: attributes.details?.rust_queued_players ?? 0,
    region: location[0] ?? 'Unknown',
    country: location[1] ?? 'Unknown',
    map: map?.name ?? 'Unknown map',
    mapSize: map?.size ?? null,
    seed: map?.seed ?? null,
    status: attributes.status ?? 'unknown',
    lastWipe: attributes.details?.rust_last_wipe ?? null,
    nextWipe: attributes.details?.rust_next_wipe ?? null,
  };
}
