export type ServerSummary = {
  id: string;
  name: string;
  description: string;
  ip: string;
  port: number;
  players: number;
  maxPlayers: number;
  queue: number;
  ping: number | null;
  region: string;
  country: string;
  map: string;
  mapSize: number;
  seed: number;
  wipeSchedule: string;
  wipeAgeHours: number;
  status: 'online' | 'offline';
  rank?: number;
  updatedAt?: string;
  source?: 'demo' | 'battlemetrics';
  mapImageUrl?: string;
  mapThumbnailUrl?: string;
  mapUrl?: string;
  mapProvider?: 'rustmaps';
  mapSummary?: {
    landPercentageOfMap?: number;
    biomePercentages?: Record<string, number>;
    totalMonuments?: number;
    largeMonuments?: number;
    smallMonuments?: number;
    safezones?: number;
    caves?: number;
  };
  connectedPlayers: ConnectedPlayer[];
  markers: MapMarker[];
  activity: ActivityEvent[];
};

export type TrackedPlayerPreview = {
  id: string;
  name: string;
  server: string;
  tags: string[];
  status: 'connected' | 'disconnected';
  lastSeen: string;
};

export type ConnectedPlayer = {
  id: string;
  name: string;
  onlineMinutes: number;
  lastSeen: string;
  tags: string[];
};

export type MapMarker = {
  id: string;
  label: string;
  note: string;
  x: number;
  y: number;
  tone: 'rust' | 'sky' | 'green' | 'gold';
};

export type ActivityEvent = {
  id: string;
  time: string;
  playerName: string;
  type: 'connected' | 'disconnected' | 'note';
};
