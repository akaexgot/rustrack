import type { MapMarker, ServerSummary } from '@/lib/battlemetrics/types';
import type { RustMapInfo } from '@/lib/rustmaps/types';

export async function enrichServerWithRustMap(server: ServerSummary): Promise<ServerSummary> {
  if (!server.seed || !server.mapSize) {
    return server;
  }

  const mapUrl = buildRustMapsUrl(server.mapSize, server.seed, 'Procedural');

  try {
    const response = await fetch(`/api/rustmaps/${server.mapSize}/${server.seed}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return { ...server, mapUrl };
    }

    const mapInfo = (await response.json()) as RustMapInfo;

    return {
      ...server,
      map: `${mapInfo.type} ${mapInfo.size}`,
      mapImageUrl: mapInfo.imageUrl,
      mapThumbnailUrl: mapInfo.thumbnailUrl,
      mapUrl: mapInfo.url,
      mapProvider: 'rustmaps',
      mapSummary: {
        landPercentageOfMap: mapInfo.landPercentageOfMap,
        biomePercentages: mapInfo.biomePercentages,
        totalMonuments: mapInfo.totalMonuments,
        largeMonuments: mapInfo.largeMonuments,
        smallMonuments: mapInfo.smallMonuments,
        safezones: mapInfo.safezones,
        caves: mapInfo.caves,
      },
      markers: mapInfo.monuments.length ? monumentsToMarkers(mapInfo) : server.markers,
    };
  } catch {
    return { ...server, mapUrl };
  }
}

export function buildRustMapsUrl(size: number, seed: number, type = 'Procedural') {
  return `https://rustmaps.com/map/${encodeURIComponent(type)}/${size}_${seed}`;
}

function monumentsToMarkers(mapInfo: RustMapInfo): MapMarker[] {
  return mapInfo.monuments
    .filter((monument) =>
      ['LargeMonument', 'SmallMonument', 'Cave'].includes(monument.sizeCategory),
    )
    .slice(0, 9)
    .map((monument, index) => ({
      id: `${mapInfo.id}-${index}-${monument.type}`,
      label: shortenMonument(monument.type),
      note: monument.type,
      x: clamp(((monument.x + mapInfo.size / 2) / mapInfo.size) * 100),
      y: clamp(((mapInfo.size / 2 - monument.y) / mapInfo.size) * 100),
      tone: markerTone(monument.sizeCategory),
    }));
}

function markerTone(sizeCategory: string): MapMarker['tone'] {
  if (sizeCategory === 'LargeMonument') return 'rust';
  if (sizeCategory === 'SmallMonument') return 'sky';
  if (sizeCategory === 'Cave') return 'gold';
  return 'green';
}

function shortenMonument(value: string) {
  return value
    .replace('Nuclear Missile Silo', 'Silo')
    .replace('Military Tunnels', 'Mil Tunnels')
    .replace('Arctic Research Base', 'Arctic')
    .replace('Satellite Dish', 'Dish')
    .replace('Sewer Branch', 'Sewer')
    .slice(0, 13);
}

function clamp(value: number) {
  return Math.max(5, Math.min(95, value));
}
