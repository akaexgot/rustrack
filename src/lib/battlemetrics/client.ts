import type { ActivityEvent, ConnectedPlayer, ServerSummary } from '@/lib/battlemetrics/types';
import { enrichServerWithRustMap } from '@/lib/rustmaps/client';

type BattlemetricsServerResource = {
  type: 'server';
  id: string;
  attributes: {
    id?: string;
    name?: string;
    ip?: string;
    port?: number;
    players?: number;
    maxPlayers?: number;
    rank?: number;
    status?: string;
    country?: string;
    updatedAt?: string;
    details?: {
      map?: string;
      rust_description?: string;
      rust_headerimage?: string;
      rust_world_size?: number;
      rust_world_seed?: number;
      rust_queued_players?: number;
      rust_last_wipe?: string;
      rust_next_wipe?: string;
      rust_url?: string;
      rust_type?: string;
      official?: boolean;
      pve?: boolean;
    };
  };
};

type BattlemetricsPlayerResource = {
  type: 'player';
  id: string;
  attributes: {
    id?: string;
    name?: string;
    updatedAt?: string;
  };
};

type BattlemetricsResponse = {
  data: BattlemetricsServerResource | BattlemetricsServerResource[];
  included?: BattlemetricsPlayerResource[];
};

const apiBaseUrl = '/api/battlemetrics';

export async function getPopularRustServers(limit = 6) {
  const params = new URLSearchParams({
    'filter[game]': 'rust',
    'page[size]': String(limit),
    sort: '-players',
  });

  const response = await battlemetricsRequest(`/servers?${params.toString()}`);
  const resources = Array.isArray(response.data) ? response.data : [response.data];
  return resources.map((resource) => normalizeServer(resource, []));
}

export async function searchRustServers(query: string, limit = 8) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return getPopularRustServers();

  if (/^\d{4,}$/.test(cleanQuery)) {
    const server = await getRustServer(cleanQuery);
    return [server];
  }

  const addressQuery = parseAddressQuery(cleanQuery);
  if (addressQuery) {
    const params = new URLSearchParams({
      'filter[game]': 'rust',
      'filter[search]': addressQuery.ip,
      'page[size]': '100',
      sort: '-players',
    });

    const response = await battlemetricsRequest(`/servers?${params.toString()}`);
    const resources = Array.isArray(response.data) ? response.data : [response.data];
    const normalized = resources.map((resource) => normalizeServer(resource, []));

    return normalized.filter(
      (server) =>
        server.ip === addressQuery.ip &&
        (addressQuery.port === undefined || server.port === addressQuery.port),
    );
  }

  const params = new URLSearchParams({
    'filter[game]': 'rust',
    'filter[search]': cleanQuery,
    'page[size]': String(limit),
    sort: '-players',
  });

  const response = await battlemetricsRequest(`/servers?${params.toString()}`);
  const resources = Array.isArray(response.data) ? response.data : [response.data];
  return resources.map((resource) => normalizeServer(resource, []));
}

export async function getRustServer(serverId: string) {
  const response = await battlemetricsRequest(
    `/servers/${encodeURIComponent(serverId)}?include=player`,
  );
  const resource = Array.isArray(response.data) ? response.data[0] : response.data;
  return enrichServerWithRustMap(normalizeServer(resource, response.included ?? []));
}

async function battlemetricsRequest(path: string): Promise<BattlemetricsResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`BattleMetrics ${response.status}`);
  }

  return (await response.json()) as BattlemetricsResponse;
}

function normalizeServer(
  resource: BattlemetricsServerResource,
  included: BattlemetricsPlayerResource[],
): ServerSummary {
  const attributes = resource.attributes;
  const details = attributes.details ?? {};
  const connectedPlayers = normalizePlayers(included);
  const lastWipe = parseDate(details.rust_last_wipe);
  const nextWipe = parseFutureDate(details.rust_next_wipe);

  return {
    id: resource.id,
    name: attributes.name ?? 'Rust server',
    description: cleanDescription(details.rust_description) || buildDescription(attributes),
    ip: attributes.ip ?? '',
    port: attributes.port ?? 0,
    players: attributes.players ?? connectedPlayers.length,
    maxPlayers: attributes.maxPlayers ?? 0,
    queue: details.rust_queued_players ?? 0,
    ping: null,
    region: attributes.country ?? 'BattleMetrics',
    country: attributes.country ?? 'N/A',
    map: details.map ?? 'Rust map',
    mapSize: details.rust_world_size ?? 0,
    seed: details.rust_world_seed ?? 0,
    wipeSchedule: nextWipe ? formatDate(nextWipe) : 'No disponible',
    wipeAgeHours: lastWipe ? hoursSince(lastWipe) : 0,
    status: attributes.status === 'online' ? 'online' : 'offline',
    rank: attributes.rank,
    updatedAt: attributes.updatedAt,
    source: 'battlemetrics',
    connectedPlayers,
    markers: [],
    activity: buildActivity(connectedPlayers),
  };
}

function normalizePlayers(included: BattlemetricsPlayerResource[]): ConnectedPlayer[] {
  return included
    .filter((resource) => resource.type === 'player')
    .slice(0, 80)
    .map((resource) => ({
      id: resource.id,
      name: resource.attributes.name ?? `Player ${resource.id}`,
      onlineMinutes: 0,
      lastSeen: resource.attributes.updatedAt
        ? formatDate(new Date(resource.attributes.updatedAt))
        : 'Ahora',
      tags: [],
    }));
}

function buildActivity(players: ConnectedPlayer[]): ActivityEvent[] {
  return players.slice(0, 8).map((player, index) => ({
    id: `real-${player.id}`,
    time: index === 0 ? 'Ahora' : '--:--',
    playerName: player.name,
    type: 'connected',
  }));
}

function buildDescription(attributes: BattlemetricsServerResource['attributes']) {
  const details = attributes.details ?? {};
  const chunks = [
    details.official ? 'Official' : null,
    details.rust_type,
    details.pve ? 'PVE' : null,
    attributes.country,
  ].filter(Boolean);

  return chunks.length ? chunks.join(' / ') : 'Servidor Rust desde BattleMetrics.';
}

function cleanDescription(value: string | undefined) {
  if (!value) return '';
  return value.replace(/\\t/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFutureDate(value: string | undefined) {
  const date = parseDate(value);
  if (!date || date.getTime() <= Date.now()) return null;
  return date;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function hoursSince(date: Date) {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 36e5));
}

function parseAddressQuery(value: string) {
  const match = value.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/);
  if (!match) return null;

  const ip = match[1];
  const octets = ip.split('.').map(Number);
  const validIp = octets.every((octet) => octet >= 0 && octet <= 255);
  const port = match[2] ? Number(match[2]) : undefined;
  const validPort = port === undefined || (port > 0 && port <= 65535);

  if (!validIp || !validPort) return null;
  return { ip, port };
}
