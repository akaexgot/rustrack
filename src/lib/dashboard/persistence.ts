import type { SupabaseClient } from '@supabase/supabase-js';

export type DashboardAlertSettings = {
  trackedOnline: boolean;
  trackedOffline: boolean;
  queue: boolean;
  wipe: boolean;
  notes: boolean;
};

export type DashboardUiSettings = {
  compactPlayers: boolean;
  mapLabels: boolean;
  autoOpenTracked: boolean;
};

export type PersistedTrackedPlayer = {
  dbId?: string;
  id: string;
  name: string;
  serverId: string;
  serverName: string;
  group?: string;
  baseLocation?: string;
  tags: string[];
  notes: string[];
};

type TrackedRow = {
  id: string;
  battlemetrics_server_id: string;
  battlemetrics_player_id: string;
  display_name: string | null;
  group_name: string | null;
  base_location: string | null;
};

type NoteRow = {
  tracked_player_id: string;
  body: string;
};

type TagLinkRow = {
  tracked_player_id: string;
  player_tags: { name: string } | { name: string }[] | null;
};

type SettingsRow = {
  voice_enabled: boolean;
  alert_settings: Partial<DashboardAlertSettings> | null;
  ui_settings: Partial<DashboardUiSettings> | null;
};

export const defaultAlertSettings: DashboardAlertSettings = {
  trackedOnline: true,
  trackedOffline: true,
  queue: false,
  wipe: true,
  notes: false,
};

export const defaultUiSettings: DashboardUiSettings = {
  compactPlayers: true,
  mapLabels: true,
  autoOpenTracked: false,
};

export async function loadDashboardState(supabase: SupabaseClient, userId: string) {
  const [favoritesResponse, trackedResponse, settingsResponse] = await Promise.all([
    supabase
      .from('favorite_servers')
      .select('battlemetrics_server_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tracked_players')
      .select('id,battlemetrics_server_id,battlemetrics_player_id,display_name,group_name,base_location')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_settings')
      .select('voice_enabled,alert_settings,ui_settings')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (favoritesResponse.error) throw favoritesResponse.error;
  if (trackedResponse.error) throw trackedResponse.error;

  const trackedRows = (trackedResponse.data ?? []) as TrackedRow[];
  const trackedDbIds = trackedRows.map((row) => row.id);
  const [notesResponse, tagLinksResponse] = trackedDbIds.length
    ? await Promise.all([
        supabase
          .from('player_notes')
          .select('tracked_player_id,body')
          .in('tracked_player_id', trackedDbIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('tracked_player_tags')
          .select('tracked_player_id,player_tags(name)')
          .in('tracked_player_id', trackedDbIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (notesResponse.error) throw notesResponse.error;
  if (tagLinksResponse.error) throw tagLinksResponse.error;

  if (settingsResponse.error) throw settingsResponse.error;

  const notesByTrackedId = new Map<string, string[]>();
  ((notesResponse.data ?? []) as NoteRow[]).forEach((note) => {
    notesByTrackedId.set(note.tracked_player_id, [
      ...(notesByTrackedId.get(note.tracked_player_id) ?? []),
      note.body,
    ]);
  });

  const tagsByTrackedId = new Map<string, string[]>();
  ((tagLinksResponse.data ?? []) as TagLinkRow[]).forEach((link) => {
    const tag = Array.isArray(link.player_tags) ? link.player_tags[0] : link.player_tags;
    if (!tag?.name) return;
    tagsByTrackedId.set(link.tracked_player_id, [
      ...(tagsByTrackedId.get(link.tracked_player_id) ?? []),
      tag.name,
    ]);
  });

  const settings = settingsResponse.data as SettingsRow | null;

  return {
    favoriteServerIds: ((favoritesResponse.data ?? []) as { battlemetrics_server_id: string }[]).map(
      (row) => row.battlemetrics_server_id,
    ),
    tracked: trackedRows.map((row) => ({
      dbId: row.id,
      id: row.battlemetrics_player_id,
      name: row.display_name ?? row.battlemetrics_player_id,
      serverId: row.battlemetrics_server_id,
      serverName: row.battlemetrics_server_id,
      group: row.group_name ?? 'General',
      baseLocation: row.base_location ?? undefined,
      tags: tagsByTrackedId.get(row.id) ?? [],
      notes: notesByTrackedId.get(row.id) ?? [],
    })),
    voiceEnabled: settings?.voice_enabled ?? false,
    alertSettings: { ...defaultAlertSettings, ...(settings?.alert_settings ?? {}) },
    uiSettings: { ...defaultUiSettings, ...(settings?.ui_settings ?? {}) },
  };
}

export async function saveFavoriteServer(
  supabase: SupabaseClient,
  userId: string,
  serverId: string,
  favorite: boolean,
) {
  const response = favorite
    ? await supabase
        .from('favorite_servers')
        .insert({ user_id: userId, battlemetrics_server_id: serverId })
    : await supabase
        .from('favorite_servers')
        .delete()
        .eq('user_id', userId)
        .eq('battlemetrics_server_id', serverId);

  if (response.error) throw response.error;
}

export async function saveTrackedPlayer(
  supabase: SupabaseClient,
  userId: string,
  player: PersistedTrackedPlayer,
) {
  const { data, error } = await supabase
    .from('tracked_players')
    .upsert(
      {
        user_id: userId,
        battlemetrics_server_id: player.serverId,
        battlemetrics_player_id: player.id,
        display_name: player.name,
        group_name: player.group ?? 'General',
        base_location: player.baseLocation ?? null,
      },
      { onConflict: 'user_id,battlemetrics_server_id,battlemetrics_player_id' },
    )
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function saveTrackedPlayerIntel(
  supabase: SupabaseClient,
  userId: string,
  trackedPlayerId: string,
  intel: { group?: string; baseLocation?: string | null },
) {
  const patch: { group_name?: string; base_location?: string | null } = {};
  if (intel.group !== undefined) patch.group_name = intel.group || 'General';
  if (intel.baseLocation !== undefined) patch.base_location = intel.baseLocation || null;

  const { error } = await supabase
    .from('tracked_players')
    .update(patch)
    .eq('id', trackedPlayerId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function savePlayerNote(
  supabase: SupabaseClient,
  userId: string,
  trackedPlayerId: string,
  body: string,
) {
  const { error } = await supabase.from('player_notes').insert({
    user_id: userId,
    tracked_player_id: trackedPlayerId,
    body,
  });

  if (error) throw error;
}

export async function savePlayerTag(
  supabase: SupabaseClient,
  userId: string,
  trackedPlayerId: string,
  name: string,
) {
  const { data: existingTag, error: selectError } = await supabase
    .from('player_tags')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .maybeSingle();

  if (selectError) throw selectError;

  const tagId = existingTag
    ? (existingTag as { id: string }).id
    : await insertPlayerTag(supabase, userId, name);

  const { error: linkError } = await supabase
    .from('tracked_player_tags')
    .insert({ tracked_player_id: trackedPlayerId, tag_id: tagId });

  if (linkError && linkError.code !== '23505') throw linkError;
}

async function insertPlayerTag(supabase: SupabaseClient, userId: string, name: string) {
  const { data, error } = await supabase
    .from('player_tags')
    .insert({ user_id: userId, name })
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function removePlayerTag(
  supabase: SupabaseClient,
  userId: string,
  trackedPlayerId: string,
  name: string,
) {
  const { data, error } = await supabase
    .from('player_tags')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  const { error: deleteError } = await supabase
    .from('tracked_player_tags')
    .delete()
    .eq('tracked_player_id', trackedPlayerId)
    .eq('tag_id', (data as { id: string }).id);

  if (deleteError) throw deleteError;
}

export async function saveDashboardSettings(
  supabase: SupabaseClient,
  userId: string,
  voiceEnabled: boolean,
  alertSettings: DashboardAlertSettings,
  uiSettings: DashboardUiSettings,
) {
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      voice_enabled: voiceEnabled,
      alert_settings: alertSettings,
      ui_settings: uiSettings,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
}
