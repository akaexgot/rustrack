import type { APIRoute } from 'astro';

import type { RustMapInfo, RustMapMonument } from '@/lib/rustmaps/types';

type RustMapsApiMonument = {
  type?: string;
  sizeCategory?: string;
  coordinates?: {
    x?: number;
    y?: number;
  };
};

type RustMapsApiResponse = {
  data?: {
    id?: string;
    type?: string;
    seed?: number;
    size?: number;
    imageUrl?: string;
    thumbnailUrl?: string;
    landPercentageOfMap?: number;
    biomePercentages?: Record<string, number>;
    totalMonuments?: number;
    largeMonuments?: number;
    smallMonuments?: number;
    safezones?: number;
    caves?: number;
    monuments?: RustMapsApiMonument[];
  };
};

export const GET: APIRoute = async ({ params }) => {
  const size = Number(params.size);
  const seed = Number(params.seed);

  if (!Number.isFinite(size) || !Number.isFinite(seed) || size <= 0 || seed <= 0) {
    return json({ message: 'Invalid map size or seed' }, 400);
  }

  const response = await fetch(`https://api.rustmaps.com/internal/v1/maps/${size}/${seed}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Rustrack/0.1 (+https://rustrack.app)',
    },
  });

  if (!response.ok) {
    return json({ message: 'RustMaps map not available yet' }, response.status);
  }

  const payload = (await response.json()) as RustMapsApiResponse;
  const map = payload.data;

  if (!map?.id || !map.imageUrl || !map.thumbnailUrl) {
    return json({ message: 'RustMaps response is incomplete' }, 502);
  }

  const type = map.type ?? 'Procedural';
  const mapInfo: RustMapInfo = {
    id: map.id,
    type,
    seed: map.seed ?? seed,
    size: map.size ?? size,
    imageUrl: map.imageUrl,
    thumbnailUrl: map.thumbnailUrl,
    url: `https://rustmaps.com/map/${encodeURIComponent(type)}/${size}_${seed}`,
    landPercentageOfMap: map.landPercentageOfMap,
    biomePercentages: map.biomePercentages,
    totalMonuments: map.totalMonuments,
    largeMonuments: map.largeMonuments,
    smallMonuments: map.smallMonuments,
    safezones: map.safezones,
    caves: map.caves,
    monuments: normalizeMonuments(map.monuments ?? []),
  };

  return json(mapInfo, 200, {
    'Cache-Control': 'public, max-age=21600, stale-while-revalidate=86400',
  });
};

function normalizeMonuments(monuments: RustMapsApiMonument[]): RustMapMonument[] {
  return monuments
    .filter(
      (monument) =>
        monument.type &&
        monument.sizeCategory &&
        Number.isFinite(monument.coordinates?.x) &&
        Number.isFinite(monument.coordinates?.y),
    )
    .map((monument) => ({
      type: monument.type ?? 'Monument',
      sizeCategory: monument.sizeCategory ?? 'Unknown',
      x: monument.coordinates?.x ?? 0,
      y: monument.coordinates?.y ?? 0,
    }));
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
