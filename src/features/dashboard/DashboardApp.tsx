import {
  BellRing,
  Check,
  Clock3,
  ExternalLink,
  Gauge,
  Heart,
  Lock,
  LogIn,
  MessageSquare,
  Plus,
  Search,
  Server as ServerIcon,
  Settings,
  Shield,
  Tag,
  Users,
  Volume2,
  VolumeX,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  getPopularRustServers,
  getRustServer,
  searchRustServers,
} from '@/lib/battlemetrics/client';
import { popularServers } from '@/lib/battlemetrics/mock';
import type { ConnectedPlayer, ServerSummary } from '@/lib/battlemetrics/types';
import {
  defaultAlertSettings,
  defaultUiSettings,
  loadDashboardState,
  removePlayerTag,
  saveDashboardSettings,
  saveFavoriteServer,
  savePlayerNote,
  savePlayerTag,
  saveTrackedPlayer,
  type DashboardAlertSettings,
  type DashboardUiSettings,
} from '@/lib/dashboard/persistence';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { localizedPath } from '@/lib/i18n/routing';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Props = {
  locale: Locale;
  dictionary: Dictionary;
  initialQuery?: string;
};

type GuestTrackedPlayer = {
  dbId?: string;
  id: string;
  name: string;
  serverId: string;
  serverName: string;
  group?: string;
  tags: string[];
  notes: string[];
};

type DashboardMode = 'server' | 'tactical' | 'settings';

const defaultTags = ['Muy activo', 'Posible aliado', 'Clan enemigo', 'Vive cerca', 'Tiene AK'];
const defaultGroups = ['Team rojo', 'Team azul', 'Vecinos', 'Raid Targets', 'Aliados'];
export default function DashboardApp({ locale, dictionary, initialQuery = '' }: Props) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const initialServer = useMemo(() => findBestServer(initialQuery), [initialQuery]);
  const trackedPresenceRef = useRef<Record<string, boolean>>({});
  const [query, setQuery] = useState(initialQuery || initialServer.ip);
  const [servers, setServers] = useState<ServerSummary[]>(popularServers);
  const [selectedServerId, setSelectedServerId] = useState(initialServer.id);
  const [selectedServerOverride, setSelectedServerOverride] = useState<ServerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [favoriteServerIds, setFavoriteServerIds] = useState<string[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tracked, setTracked] = useState<GuestTrackedPlayer[]>([]);
  const [activeTrackedId, setActiveTrackedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [groupDraft, setGroupDraft] = useState('');
  const [selectionRequired, setSelectionRequired] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('server');
  const [alertSettings, setAlertSettings] =
    useState<DashboardAlertSettings>(defaultAlertSettings);
  const [uiSettings, setUiSettings] = useState<DashboardUiSettings>(defaultUiSettings);

  const selectedServer =
    selectionRequired
      ? null
      : (
    selectedServerOverride ??
    servers.find((server) => server.id === selectedServerId) ??
    servers[0] ??
    null
        );
  const selectedTracked = tracked.find((player) => player.id === activeTrackedId) ?? null;
  const filteredServers = useMemo(() => filterServers(query, servers), [query, servers]);
  const trackedOnlineCount = selectedServer ? countTrackedOnline(tracked, selectedServer) : 0;
  const emptyTitle = selectionRequired
    ? dictionary.dashboard.chooseServer
    : dictionary.dashboard.noResults;

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const results = initialQuery.trim()
          ? await searchRustServers(initialQuery)
          : await getPopularRustServers();
        if (!active) return;

        const nextServers = results.length ? results : popularServers;
        if (initialQuery.trim() && !results.length) {
          setServers([]);
          setSelectedServerId('');
          setSelectedServerOverride(null);
          setSelectionRequired(false);
          setErrorMessage(dictionary.dashboard.noExactServer);
          return;
        }

        setServers(nextServers);
        if (isIpOnlyQuery(initialQuery) && results.length > 1) {
          setSelectedServerId('');
          setSelectedServerOverride(null);
          setSelectionRequired(true);
          setErrorMessage(dictionary.dashboard.multipleIpMatches);
          return;
        }

        setSelectionRequired(false);
        const first = nextServers[0];
        if (first) {
          const detail = await getRustServer(first.id);
          if (!active) return;
          setSelectedServerId(detail.id);
          setSelectedServerOverride(detail);
          setQuery(initialQuery.trim() || detail.ip || detail.name);
        }
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? `BattleMetrics no ha respondido correctamente: ${error.message}`
            : 'BattleMetrics no ha respondido correctamente.',
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, [initialQuery]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;

    loadDashboardState(supabase, userId)
      .then((state) => {
        if (!active) return;
        setFavoriteServerIds(state.favoriteServerIds);
        setTracked(state.tracked);
        setVoiceEnabled(state.voiceEnabled);
        setAlertSettings(state.alertSettings);
        setUiSettings(state.uiSettings);
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? `Supabase no ha cargado tu perfil: ${error.message}`
            : 'Supabase no ha cargado tu perfil.',
        );
      });

    return () => {
      active = false;
    };
  }, [supabase, userId]);

  useEffect(() => {
    if (!selectedServerId || selectionRequired) return;

    let active = true;

    async function refreshServerStatus() {
      try {
        const detail = await getRustServer(selectedServerId);
        if (!active) return;

        setSelectedServerOverride(detail);
        setServers((current) =>
          current.map((server) => (server.id === detail.id ? detail : server)),
        );
      } catch {
        // Silent refreshes should not interrupt the tactical panel.
      }
    }

    const intervalId = window.setInterval(refreshServerStatus, 45000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshServerStatus();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedServerId, selectionRequired]);

  useEffect(() => {
    if (!selectedServer) {
      trackedPresenceRef.current = {};
      return;
    }

    const serverTrackedPlayers = tracked.filter((player) => player.serverId === selectedServer.id);
    const previousPresence = trackedPresenceRef.current;
    const nextPresence: Record<string, boolean> = {};

    serverTrackedPlayers.forEach((player) => {
      const online = isTrackedOnline(player, selectedServer);
      nextPresence[player.id] = online;

      if (previousPresence[player.id] === undefined || previousPresence[player.id] === online) {
        return;
      }

      if (online && alertSettings.trackedOnline) {
        speak(locale === 'es' ? `${player.name} se ha conectado.` : `${player.name} is online.`);
      }

      if (!online && alertSettings.trackedOffline) {
        speak(
          locale === 'es'
            ? `${player.name} se ha desconectado.`
            : `${player.name} went offline.`,
        );
      }
    });

    trackedPresenceRef.current = nextPresence;
  }, [
    alertSettings.trackedOffline,
    alertSettings.trackedOnline,
    locale,
    selectedServer,
    tracked,
    voiceEnabled,
  ]);

  async function submitSearch() {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const results = await searchRustServers(cleanQuery);
      if (!results.length) {
        setServers([]);
        setSelectedServerId('');
        setSelectedServerOverride(null);
        setSelectionRequired(false);
        setErrorMessage(dictionary.dashboard.noExactServer);
        return;
      }

      const nextServers = results;
      setServers(nextServers);
      if (isIpOnlyQuery(cleanQuery) && results.length > 1) {
        setSelectedServerId('');
        setSelectedServerOverride(null);
        setSelectionRequired(true);
        setErrorMessage(dictionary.dashboard.multipleIpMatches);
        return;
      }

      setSelectionRequired(false);
      const first = nextServers[0];
      const detail = await getRustServer(first.id);
      setSelectedServerId(detail.id);
      setSelectedServerOverride(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `BattleMetrics no ha respondido correctamente: ${error.message}`
          : 'BattleMetrics no ha respondido correctamente.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function selectServer(server: ServerSummary) {
    setSelectedServerId(server.id);
    setSelectedServerOverride(server);
    setSelectionRequired(false);
    setQuery(server.ip || server.name);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const detail = await getRustServer(server.id);
      setSelectedServerId(detail.id);
      setSelectedServerOverride(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `BattleMetrics no ha respondido correctamente: ${error.message}`
          : 'BattleMetrics no ha respondido correctamente.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function speakNow(message: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
  }

  function speak(message: string) {
    if (!voiceEnabled) return;
    speakNow(message);
  }

  function toggleVoice() {
    const nextValue = !voiceEnabled;
    setVoiceEnabled(nextValue);
    if (nextValue) {
      speakNow(locale === 'es' ? 'Alertas de voz activadas.' : 'Voice alerts enabled.');
    }
    persistSettings(nextValue, alertSettings, uiSettings);
  }

  function toggleAlertSetting(key: keyof DashboardAlertSettings) {
    setAlertSettings((current) => {
      const nextSettings = { ...current, [key]: !current[key] };
      persistSettings(voiceEnabled, nextSettings, uiSettings);
      return nextSettings;
    });
  }

  function toggleUiSetting(key: keyof DashboardUiSettings) {
    setUiSettings((current) => {
      const nextSettings = { ...current, [key]: !current[key] };
      persistSettings(voiceEnabled, alertSettings, nextSettings);
      return nextSettings;
    });
  }

  function persistSettings(
    nextVoiceEnabled: boolean,
    nextAlertSettings: DashboardAlertSettings,
    nextUiSettings: DashboardUiSettings,
  ) {
    if (!supabase || !userId) return;

    saveDashboardSettings(
      supabase,
      userId,
      nextVoiceEnabled,
      nextAlertSettings,
      nextUiSettings,
    ).catch(handlePersistenceError);
  }

  async function ensureTrackedDbId(player: GuestTrackedPlayer) {
    if (player.dbId) return player.dbId;
    if (!supabase || !userId) return null;

    const dbId = await saveTrackedPlayer(supabase, userId, player);
    setTracked((current) =>
      current.map((item) => (item.id === player.id ? { ...item, dbId } : item)),
    );
    return dbId;
  }

  function handlePersistenceError(error: unknown) {
    setErrorMessage(
      error instanceof Error
        ? `No se ha podido guardar en Supabase: ${error.message}`
        : 'No se ha podido guardar en Supabase.',
    );
  }

  function trackPlayer(player: ConnectedPlayer) {
    if (!selectedServer) return;

    const existing = tracked.find((trackedPlayer) => trackedPlayer.id === player.id);
    if (existing) {
      setActiveTrackedId(existing.id);
      return;
    }

    const nextTracked: GuestTrackedPlayer = {
      id: player.id,
      name: player.name,
      serverId: selectedServer.id,
      serverName: selectedServer.name,
      tags: player.tags.length ? player.tags : ['Muy activo'],
      notes: [],
    };

    setTracked((current) => [nextTracked, ...current]);
    if (supabase && userId) {
      saveTrackedPlayer(supabase, userId, nextTracked)
        .then((dbId) => {
          setTracked((current) =>
            current.map((item) => (item.id === nextTracked.id ? { ...item, dbId } : item)),
          );
        })
        .catch(handlePersistenceError);
    }
    if (uiSettings.autoOpenTracked) setActiveTrackedId(nextTracked.id);
    if (alertSettings.trackedOnline) {
      speak(locale === 'es' ? `${player.name} se ha conectado.` : `${player.name} is online.`);
    }
  }

  function toggleFavorite(serverId: string) {
    setFavoriteServerIds((current) => {
      const favorite = !current.includes(serverId);
      if (supabase && userId) {
        saveFavoriteServer(supabase, userId, serverId, favorite).catch(handlePersistenceError);
      }
      return favorite ? [serverId, ...current] : current.filter((id) => id !== serverId);
    });
  }

  function addNote() {
    const cleanNote = noteDraft.trim();
    if (!selectedTracked || !cleanNote) return;

    setTracked((current) =>
      current.map((player) =>
        player.id === selectedTracked.id
          ? { ...player, notes: [cleanNote, ...player.notes] }
          : player,
      ),
    );
    if (supabase && userId) {
      ensureTrackedDbId(selectedTracked)
        .then((dbId) => {
          if (!dbId) return;
          return savePlayerNote(supabase, userId, dbId, cleanNote);
        })
        .catch(handlePersistenceError);
    }
    setNoteDraft('');
  }

  function addTag(tag: string) {
    const cleanTag = tag.trim();
    if (!selectedTracked || !cleanTag) return;

    setTracked((current) =>
      current.map((player) =>
        player.id === selectedTracked.id && !player.tags.includes(cleanTag)
          ? { ...player, tags: [...player.tags, cleanTag] }
          : player,
      ),
    );
    if (supabase && userId) {
      ensureTrackedDbId(selectedTracked)
        .then((dbId) => {
          if (!dbId) return;
          return savePlayerTag(supabase, userId, dbId, cleanTag);
        })
        .catch(handlePersistenceError);
    }
    setTagDraft('');
  }

  function removeTag(tag: string) {
    if (!selectedTracked) return;

    setTracked((current) =>
      current.map((player) =>
        player.id === selectedTracked.id
          ? { ...player, tags: player.tags.filter((item) => item !== tag) }
          : player,
      ),
    );
    if (supabase && userId) {
      ensureTrackedDbId(selectedTracked)
        .then((dbId) => {
          if (!dbId) return;
          return removePlayerTag(supabase, userId, dbId, tag);
        })
        .catch(handlePersistenceError);
    }
  }

  function assignGroup(group: string) {
    const cleanGroup = group.trim();
    if (!selectedTracked || !cleanGroup) return;

    setTracked((current) =>
      current.map((player) =>
        player.id === selectedTracked.id ? { ...player, group: cleanGroup } : player,
      ),
    );
    setGroupDraft('');
  }

  function clearGroup() {
    if (!selectedTracked) return;

    setTracked((current) =>
      current.map((player) =>
        player.id === selectedTracked.id ? { ...player, group: undefined } : player,
      ),
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-topbar">
        <a className="dashboard-logo" href={localizedPath(locale, '/')}>
          <img src="/images/rustrack-logo-cropped.png" alt="Rustrack" />
        </a>
        <div className="dashboard-actions">
          <button className="dashboard-icon-button" type="button" onClick={toggleVoice}>
            {voiceEnabled ? <Volume2 size={19} aria-hidden /> : <VolumeX size={19} aria-hidden />}
          </button>
          {selectedServer ? (
            <button
              className="dashboard-text-button"
              type="button"
              onClick={() => setDashboardMode('settings')}
            >
              <Settings size={18} aria-hidden />
              <span>{dictionary.dashboard.settings}</span>
            </button>
          ) : null}
          <a
            className="dashboard-icon-button"
            href={localizedPath(locale, '/auth/login')}
            aria-label={dictionary.actions.signIn}
          >
            <LogIn size={19} aria-hidden />
          </a>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <p className="home-eyebrow">
            {userId ? dictionary.states.savedInCloud : dictionary.states.savedInMemory}
          </p>
          <h1 title={selectedServer?.name ?? emptyTitle}>{selectedServer?.name ?? emptyTitle}</h1>
          <p>{selectedServer?.description ?? dictionary.dashboard.noExactServer}</p>
          {selectedServer ? (
            <div className="dashboard-mode-switch">
              <button
                className={dashboardMode === 'server' ? 'is-active' : ''}
                type="button"
                onClick={() => setDashboardMode('server')}
              >
                <ServerIcon size={16} aria-hidden />
                {dictionary.dashboard.serverView}
              </button>
              <button
                className={dashboardMode === 'tactical' ? 'is-active' : ''}
                type="button"
                onClick={() => setDashboardMode('tactical')}
              >
                <Shield size={16} aria-hidden />
                {dictionary.dashboard.tacticalPanel}
              </button>
              <button
                className={dashboardMode === 'settings' ? 'is-active' : ''}
                type="button"
                onClick={() => setDashboardMode('settings')}
              >
                <Settings size={16} aria-hidden />
                {dictionary.dashboard.settings}
              </button>
            </div>
          ) : null}
        </div>

        <form
          className="dashboard-search"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <Search size={20} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.dashboard.serverSearchHelp}
          />
          <button type="submit">{dictionary.actions.search}</button>
        </form>
      </section>

      {errorMessage ? (
        <div className="dashboard-alert">{errorMessage}</div>
      ) : null}

      {selectedServer && dashboardMode === 'server' ? (
        <section className="dashboard-layout">
        <div className="dashboard-main">
          <ServerOverview
            dictionary={dictionary}
            server={selectedServer}
            isLoading={isLoading}
            favorite={favoriteServerIds.includes(selectedServer.id)}
            onFavorite={() => toggleFavorite(selectedServer.id)}
          />

          <section className="dashboard-grid two">
            <OnlinePlayers
              dictionary={dictionary}
              players={selectedServer.connectedPlayers}
              totalPlayers={selectedServer.players}
              tracked={tracked}
              compact={uiSettings.compactPlayers}
              onTrack={trackPlayer}
            />
            <MapIntel dictionary={dictionary} server={selectedServer} showLabels={uiSettings.mapLabels} />
          </section>

          <section className="dashboard-grid three">
            {filteredServers.map((server) => (
              <ServerSuggestion
                key={server.id}
                dictionary={dictionary}
                server={server}
                selected={server.id === selectedServer.id}
                onSelect={() => void selectServer(server)}
              />
            ))}
          </section>
        </div>

        <aside className="dashboard-side">
          <TacticalEntryCard
            dictionary={dictionary}
            trackedCount={tracked.length}
            onOpen={() => setDashboardMode('tactical')}
          />
          <SettingsEntryCard
            dictionary={dictionary}
            voiceEnabled={voiceEnabled}
            onOpen={() => setDashboardMode('settings')}
          />
          <TrackedPanel
            dictionary={dictionary}
            server={selectedServer}
            tracked={tracked}
            activeTrackedId={activeTrackedId}
            selectedTracked={selectedTracked}
            noteDraft={noteDraft}
            tagDraft={tagDraft}
            groupDraft={groupDraft}
            onSelect={setActiveTrackedId}
            onNoteDraft={setNoteDraft}
            onTagDraft={setTagDraft}
            onGroupDraft={setGroupDraft}
            onAddNote={addNote}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onAssignGroup={assignGroup}
            onClearGroup={clearGroup}
          />
          <ActivityFeed dictionary={dictionary} server={selectedServer} tracked={tracked} />
        </aside>
      </section>
      ) : null}

      {selectedServer && dashboardMode === 'tactical' ? (
        <section className="dashboard-tactical">
          <div className="dashboard-tactical-heading">
            <div>
              <span>{dictionary.dashboard.tacticalPanel}</span>
              <h2>{dictionary.dashboard.tacticalTitle}</h2>
              <p>{dictionary.dashboard.tacticalDescription}</p>
            </div>
            <button className="dashboard-primary compact" type="button" onClick={() => setDashboardMode('server')}>
              {dictionary.dashboard.serverView}
            </button>
          </div>

          <div className="dashboard-tactical-stats">
            <Stat icon={Users} label={dictionary.dashboard.trackedPlayers} value={`${tracked.length}`} />
            <Stat icon={Check} label={dictionary.dashboard.onlineTracked} value={`${trackedOnlineCount}`} />
            <Stat
              icon={MessageSquare}
              label={dictionary.dashboard.notes}
              value={`${tracked.reduce((total, player) => total + player.notes.length, 0)}`}
            />
            <Stat
              icon={Search}
              label={dictionary.dashboard.visiblePlayersShort}
              value={`${selectedServer.connectedPlayers.length}`}
            />
          </div>

          <div className="dashboard-tactical-grid">
            <TrackedPanel
              dictionary={dictionary}
              server={selectedServer}
              tracked={tracked}
              activeTrackedId={activeTrackedId}
              selectedTracked={selectedTracked}
              noteDraft={noteDraft}
              tagDraft={tagDraft}
              groupDraft={groupDraft}
              onSelect={setActiveTrackedId}
              onNoteDraft={setNoteDraft}
              onTagDraft={setTagDraft}
              onGroupDraft={setGroupDraft}
              onAddNote={addNote}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              onAssignGroup={assignGroup}
              onClearGroup={clearGroup}
            />
            <OnlinePlayers
              dictionary={dictionary}
              players={selectedServer.connectedPlayers}
              totalPlayers={selectedServer.players}
              tracked={tracked}
              compact={uiSettings.compactPlayers}
              onTrack={trackPlayer}
            />
            <ActivityFeed dictionary={dictionary} server={selectedServer} tracked={tracked} />
            <ProLockedPanel dictionary={dictionary} />
          </div>
        </section>
      ) : null}

      {selectedServer && dashboardMode === 'settings' ? (
        <SettingsPanel
          dictionary={dictionary}
          voiceEnabled={voiceEnabled}
          alertSettings={alertSettings}
          uiSettings={uiSettings}
          onVoiceToggle={toggleVoice}
          onAlertToggle={toggleAlertSetting}
          onUiToggle={toggleUiSetting}
          onTestVoice={() =>
            speakNow(locale === 'es' ? 'Alerta de prueba de Rustrack.' : 'Rustrack test alert.')
          }
          onBack={() => setDashboardMode('server')}
        />
      ) : (
        selectedServer ? null : (
        <section className="dashboard-panel dashboard-empty-state">
          <h2>{emptyTitle}</h2>
          <p>{selectionRequired ? dictionary.dashboard.multipleIpMatches : dictionary.dashboard.noExactServer}</p>
          {servers.length ? (
            <div className="dashboard-grid three dashboard-selection-grid">
              {servers.map((server) => (
                <ServerSuggestion
                  key={server.id}
                  dictionary={dictionary}
                  server={server}
                  selected={false}
                  onSelect={() => void selectServer(server)}
                />
              ))}
            </div>
          ) : null}
        </section>
        )
      )}
    </div>
  );
}

function ServerOverview({
  dictionary,
  server,
  isLoading,
  favorite,
  onFavorite,
}: {
  dictionary: Dictionary;
  server: ServerSummary;
  isLoading: boolean;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const fill = server.maxPlayers ? Math.round((server.players / server.maxPlayers) * 100) : 0;
  const isBusy = server.queue > 10;

  return (
    <section className="dashboard-panel server-overview">
      <div className="dashboard-panel-heading">
        <div>
          <span>{dictionary.dashboard.selectedServer}</span>
          <h2>
            {server.ip}:{server.port}
          </h2>
          {server.rank ? <small>BattleMetrics rank #{server.rank}</small> : null}
        </div>
        <button className="dashboard-icon-button" type="button" onClick={onFavorite}>
          <Heart size={18} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
        </button>
      </div>

      <div className="dashboard-progress">
        <div>
          <span>{dictionary.dashboard.livePlayers}</span>
          <strong>
            {server.players}/{server.maxPlayers}
          </strong>
        </div>
        <div>
          <i style={{ width: `${fill}%` }} />
        </div>
      </div>

      <div className="dashboard-stats">
        <Stat icon={Users} label={dictionary.dashboard.queue} value={`${server.queue}`} />
        <Stat
          icon={Gauge}
          label={dictionary.dashboard.ping}
          value={server.ping === null ? dictionary.states.unavailable : `${server.ping} ms`}
        />
        <Stat
          icon={Clock3}
          label={dictionary.dashboard.wipeAge}
          value={`${server.wipeAgeHours}h`}
        />
        <Stat
          icon={BellRing}
          label={dictionary.dashboard.wipeSchedule}
          value={server.wipeSchedule}
        />
      </div>

      <div className="dashboard-read">
        <span>{dictionary.dashboard.recommendation}</span>
        <strong>
          {isLoading
            ? 'Actualizando BattleMetrics...'
            : isBusy
              ? dictionary.dashboard.busyMoment
              : dictionary.dashboard.goodMoment}
        </strong>
        <p>
          {server.map} / {server.region} / {server.country}
        </p>
      </div>
    </section>
  );
}

function OnlinePlayers({
  dictionary,
  players,
  totalPlayers,
  tracked,
  compact,
  onTrack,
}: {
  dictionary: Dictionary;
  players: ConnectedPlayer[];
  totalPlayers: number;
  tracked: GuestTrackedPlayer[];
  compact: boolean;
  onTrack: (player: ConnectedPlayer) => void;
}) {
  const [playerQuery, setPlayerQuery] = useState('');
  const visiblePlayers = players.filter((player) =>
    player.name.toLowerCase().includes(playerQuery.trim().toLowerCase()),
  );

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <div>
          <span>{dictionary.dashboard.onlineNow}</span>
          <h2>{totalPlayers}</h2>
          <small>
            {players.length} {dictionary.dashboard.visiblePlayers}
          </small>
        </div>
      </div>

      <label className="dashboard-player-search">
        <Search size={16} aria-hidden />
        <input
          value={playerQuery}
          onChange={(event) => setPlayerQuery(event.target.value)}
          placeholder={dictionary.dashboard.playerSearch}
        />
      </label>

      <div className={compact ? 'dashboard-list compact' : 'dashboard-list'}>
        {visiblePlayers.length ? (
          visiblePlayers.map((player) => {
          const isTracked = tracked.some((item) => item.id === player.id);
          return (
            <div className="dashboard-list-row" key={player.id}>
              <div>
                <strong>{player.name}</strong>
                <span>{player.onlineMinutes} min</span>
              </div>
              <button type="button" onClick={() => onTrack(player)}>
                {isTracked ? <Check size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
                {isTracked ? dictionary.actions.tracked : dictionary.actions.track}
              </button>
            </div>
          );
          })
        ) : (
          <p className="dashboard-empty">{dictionary.dashboard.noVisiblePlayers}</p>
        )}
      </div>
    </section>
  );
}

function MapIntel({
  dictionary,
  server,
  showLabels,
}: {
  dictionary: Dictionary;
  server: ServerSummary;
  showLabels: boolean;
}) {
  const mainMonuments =
    (server.mapSummary?.largeMonuments ?? 0) + (server.mapSummary?.smallMonuments ?? 0);

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <div>
          <span>{dictionary.dashboard.mapIntel}</span>
          <h2>
            {server.mapSize} / {dictionary.dashboard.seed} {server.seed}
          </h2>
        </div>
      </div>
      <div className="dashboard-map">
        {server.mapImageUrl || server.mapThumbnailUrl ? (
          <img
            src={server.mapImageUrl ?? server.mapThumbnailUrl}
            alt={`${server.name} ${dictionary.dashboard.map}`}
            decoding="async"
          />
        ) : null}
        <div className="dashboard-map-vignette" />
        {showLabels ? server.markers.map((marker) => (
          <span
            key={marker.id}
            style={{
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              background: markerColor(marker.tone),
            }}
          >
            {marker.label}
          </span>
        )) : null}
      </div>
      <div className="dashboard-map-meta">
        {server.mapProvider === 'rustmaps' ? (
          <span>{dictionary.dashboard.mapRealSource}</span>
        ) : (
          <span>{dictionary.dashboard.mapFallback}</span>
        )}
        {server.mapUrl ? (
          <a href={server.mapUrl} target="_blank" rel="noreferrer">
            {dictionary.dashboard.mapOpenRustMaps}
            <ExternalLink size={14} aria-hidden />
          </a>
        ) : null}
      </div>
      {server.mapSummary ? (
        <div className="dashboard-map-facts">
          <span>
            <strong>{mainMonuments || server.markers.length}</strong>
            {dictionary.dashboard.mainMonuments}
          </span>
          <span>
            <strong>{server.mapSummary.safezones ?? 0}</strong>
            {dictionary.dashboard.safezones}
          </span>
          <span>
            <strong>{server.mapSummary.caves ?? 0}</strong>
            {dictionary.dashboard.caves}
          </span>
          {server.mapSummary.landPercentageOfMap ? (
            <span>
              <strong>{Math.round(server.mapSummary.landPercentageOfMap)}%</strong>
              {dictionary.dashboard.land}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="dashboard-mini-notes">
        {server.markers.slice(0, 4).map((marker) => (
          <p key={marker.id}>
            <strong>{marker.label}</strong> {marker.note}
          </p>
        ))}
      </div>
    </section>
  );
}

function TacticalEntryCard({
  dictionary,
  trackedCount,
  onOpen,
}: {
  dictionary: Dictionary;
  trackedCount: number;
  onOpen: () => void;
}) {
  return (
    <section className="dashboard-panel dashboard-tactical-entry">
      <span>{dictionary.dashboard.tacticalPanel}</span>
      <h2>{dictionary.dashboard.tacticalTitle}</h2>
      <p>{dictionary.dashboard.tacticalDescription}</p>
      <button className="dashboard-primary" type="button" onClick={onOpen}>
        <Shield size={16} aria-hidden />
        {dictionary.dashboard.openTactical}
      </button>
      <small>
        {trackedCount} {dictionary.dashboard.trackedPlayers.toLowerCase()}
      </small>
    </section>
  );
}

function SettingsEntryCard({
  dictionary,
  voiceEnabled,
  onOpen,
}: {
  dictionary: Dictionary;
  voiceEnabled: boolean;
  onOpen: () => void;
}) {
  return (
    <section className="dashboard-panel dashboard-tactical-entry dashboard-settings-entry">
      <span>{dictionary.dashboard.settings}</span>
      <h2>{dictionary.dashboard.settingsEntryTitle}</h2>
      <p>{dictionary.dashboard.settingsEntryDescription}</p>
      <button className="dashboard-primary" type="button" onClick={onOpen}>
        <Settings size={16} aria-hidden />
        {dictionary.dashboard.openSettings}
      </button>
      <small>{voiceEnabled ? dictionary.actions.voiceOn : dictionary.actions.voiceOff}</small>
    </section>
  );
}

function ServerSuggestion({
  dictionary,
  server,
  selected,
  onSelect,
}: {
  dictionary: Dictionary;
  server: ServerSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={selected ? 'dashboard-server-card selected' : 'dashboard-server-card'}
      type="button"
      onClick={onSelect}
    >
      <span title={server.name}>{server.name}</span>
      <strong>
        {server.players}/{server.maxPlayers}
      </strong>
      <small>
        {dictionary.dashboard.queue} {server.queue} / {dictionary.dashboard.ping}{' '}
        {server.ping === null ? dictionary.states.unavailable : `${server.ping}ms`}
      </small>
    </button>
  );
}

function TrackedPanel({
  dictionary,
  server,
  tracked,
  activeTrackedId,
  selectedTracked,
  noteDraft,
  tagDraft,
  groupDraft,
  onSelect,
  onNoteDraft,
  onTagDraft,
  onGroupDraft,
  onAddNote,
  onAddTag,
  onRemoveTag,
  onAssignGroup,
  onClearGroup,
}: {
  dictionary: Dictionary;
  server: ServerSummary;
  tracked: GuestTrackedPlayer[];
  activeTrackedId: string | null;
  selectedTracked: GuestTrackedPlayer | null;
  noteDraft: string;
  tagDraft: string;
  groupDraft: string;
  onSelect: (id: string | null) => void;
  onNoteDraft: (value: string) => void;
  onTagDraft: (value: string) => void;
  onGroupDraft: (value: string) => void;
  onAddNote: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAssignGroup: (group: string) => void;
  onClearGroup: () => void;
}) {
  const onlineCount = countTrackedOnline(tracked, server);
  const selectedTrackedOnline = selectedTracked
    ? isTrackedOnline(selectedTracked, server)
    : false;

  return (
    <section className="dashboard-panel dashboard-tracked-panel">
      <div className="dashboard-panel-heading">
        <div>
          <span>{dictionary.dashboard.trackedPlayers}</span>
          <h2>
            {onlineCount}/{tracked.length} {dictionary.dashboard.onlineTrackedShort}
          </h2>
          <small>{dictionary.dashboard.tacticalHint}</small>
        </div>
      </div>

      {tracked.length ? (
        <div className="dashboard-tracked-grid">
          {tracked.map((player) => {
            const selected = player.id === activeTrackedId;
            const online = isTrackedOnline(player, server);
            const groupColor = player.group ? groupColorFor(player.group) : undefined;
            return (
              <button
                key={player.id}
                className={selected ? 'dashboard-tracked-card selected' : 'dashboard-tracked-card'}
                style={{ '--team-color': groupColor } as CSSProperties}
                type="button"
                onClick={() => onSelect(selected ? null : player.id)}
              >
                <span className="dashboard-player-avatar-wrap">
                  <span className="dashboard-player-avatar">{playerInitials(player.name)}</span>
                  <span
                    className={online ? 'dashboard-status-light online' : 'dashboard-status-light offline'}
                    aria-label={online ? dictionary.states.connected : dictionary.states.disconnected}
                  />
                </span>
                <span>
                  <strong>{player.name}</strong>
                  <small>
                    {player.group
                      ? player.group
                      : player.tags.slice(0, 2).join(' / ') || dictionary.dashboard.noTags}
                  </small>
                </span>
                <span className={online ? 'dashboard-status-pill online' : 'dashboard-status-pill offline'}>
                  {online ? dictionary.dashboard.onlineStatus : dictionary.dashboard.offlineStatus}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-empty">{dictionary.dashboard.noTracked}</p>
      )}

      {selectedTracked ? (
        <div className="dashboard-tracked-editor">
          <div className="dashboard-tracked-profile">
            <span className="dashboard-player-avatar-wrap large">
              <span className="dashboard-player-avatar large">{playerInitials(selectedTracked.name)}</span>
              <span
                className={
                  selectedTrackedOnline
                    ? 'dashboard-status-light online'
                    : 'dashboard-status-light offline'
                }
              />
            </span>
            <div>
              <strong title={selectedTracked.name}>{selectedTracked.name}</strong>
              <span title={selectedTracked.serverName}>{selectedTracked.serverName}</span>
            </div>
            <span
              className={
                selectedTrackedOnline
                  ? 'dashboard-status-pill online'
                  : 'dashboard-status-pill offline'
              }
            >
              {selectedTrackedOnline ? dictionary.dashboard.onlineStatus : dictionary.dashboard.offlineStatus}
            </span>
            <button type="button" onClick={() => onSelect(null)} aria-label={dictionary.actions.close}>
              <X size={15} aria-hidden />
            </button>
          </div>

          <div className="dashboard-player-intel">
            <span>
              <MessageSquare size={14} aria-hidden />
              {selectedTracked.notes.length} {dictionary.dashboard.notes.toLowerCase()}
            </span>
            <span>
              <Tag size={14} aria-hidden />
              {selectedTracked.tags.length} {dictionary.dashboard.tags.toLowerCase()}
            </span>
            <span className="dashboard-intel-group">
              <Users size={14} aria-hidden />
              {selectedTracked.group ?? dictionary.dashboard.noGroup}
            </span>
          </div>

          <div className="dashboard-section-label">{dictionary.dashboard.group}</div>
          <div className="dashboard-group-editor">
            <div className="dashboard-inline-input">
              <Users size={16} aria-hidden />
              <input
                value={groupDraft}
                onChange={(event) => onGroupDraft(event.target.value)}
                placeholder={dictionary.dashboard.groupPlaceholder}
              />
              <button type="button" onClick={() => onAssignGroup(groupDraft)}>
                <Plus size={15} aria-hidden />
              </button>
            </div>
            {selectedTracked.group ? (
              <button className="dashboard-group-chip active" type="button" onClick={onClearGroup}>
                <span style={{ background: groupColorFor(selectedTracked.group) }} />
                {selectedTracked.group}
                <X size={12} aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="dashboard-group-list">
            {defaultGroups.map((group) => (
              <button key={group} type="button" onClick={() => onAssignGroup(group)}>
                <span style={{ background: groupColorFor(group) }} />
                {group}
              </button>
            ))}
          </div>

          <div className="dashboard-section-label">{dictionary.dashboard.tags}</div>
          <div className="dashboard-tag-list">
            {selectedTracked.tags.length ? (
              selectedTracked.tags.map((tag) => (
                <button key={tag} type="button" onClick={() => onRemoveTag(tag)}>
                  {tag}
                  <X size={12} aria-hidden />
                </button>
              ))
            ) : (
              <span>{dictionary.dashboard.noTags}</span>
            )}
          </div>

          <div className="dashboard-inline-input">
            <Tag size={16} aria-hidden />
            <input
              value={tagDraft}
              onChange={(event) => onTagDraft(event.target.value)}
              placeholder={dictionary.dashboard.tagPlaceholder}
            />
            <button type="button" onClick={() => onAddTag(tagDraft)}>
              <Plus size={15} aria-hidden />
            </button>
          </div>

          <div className="dashboard-section-label">{dictionary.dashboard.quickTags}</div>
          <div className="dashboard-chips muted">
            {defaultTags.map((tag) => (
              <button key={tag} type="button" onClick={() => onAddTag(tag)}>
                {tag}
              </button>
            ))}
          </div>

          <textarea
            value={noteDraft}
            onChange={(event) => onNoteDraft(event.target.value)}
            placeholder={dictionary.dashboard.notePlaceholder}
          />
          <button className="dashboard-primary" type="button" onClick={onAddNote}>
            {dictionary.actions.addNote}
          </button>

          {selectedTracked.notes.length ? (
            <div className="dashboard-note-list">
              <div className="dashboard-section-label">{dictionary.dashboard.notesHistory}</div>
              {selectedTracked.notes.map((note) => (
                <p className="dashboard-note" key={note}>
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : tracked.length ? (
        <div className="dashboard-track-hint">
          <UserRound size={17} aria-hidden />
          {dictionary.dashboard.selectTrackedPlayer}
        </div>
      ) : null}
    </section>
  );
}

function SettingsPanel({
  dictionary,
  voiceEnabled,
  alertSettings,
  uiSettings,
  onVoiceToggle,
  onAlertToggle,
  onUiToggle,
  onTestVoice,
  onBack,
}: {
  dictionary: Dictionary;
  voiceEnabled: boolean;
  alertSettings: DashboardAlertSettings;
  uiSettings: DashboardUiSettings;
  onVoiceToggle: () => void;
  onAlertToggle: (key: keyof DashboardAlertSettings) => void;
  onUiToggle: (key: keyof DashboardUiSettings) => void;
  onTestVoice: () => void;
  onBack: () => void;
}) {
  return (
    <section className="dashboard-settings">
      <div className="dashboard-tactical-heading">
        <div>
          <span>{dictionary.dashboard.settings}</span>
          <h2>{dictionary.dashboard.settingsTitle}</h2>
          <p>{dictionary.dashboard.settingsDescription}</p>
        </div>
        <button className="dashboard-primary compact" type="button" onClick={onBack}>
          {dictionary.dashboard.serverView}
        </button>
      </div>

      <div className="dashboard-settings-grid">
        <section className="dashboard-panel dashboard-settings-card featured">
          <div className="dashboard-panel-heading">
            <div>
              <span>{dictionary.dashboard.voiceSettings}</span>
              <h2>{voiceEnabled ? dictionary.actions.voiceOn : dictionary.actions.voiceOff}</h2>
              <small>{dictionary.dashboard.voicePreview}</small>
            </div>
            <Volume2 size={20} aria-hidden />
          </div>

          <div className="dashboard-settings-actions">
            <button className="dashboard-primary compact" type="button" onClick={onVoiceToggle}>
              {voiceEnabled ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
              {voiceEnabled ? dictionary.actions.voiceOff : dictionary.actions.voiceOn}
            </button>
            <button className="dashboard-secondary" type="button" onClick={onTestVoice}>
              <BellRing size={16} aria-hidden />
              {dictionary.actions.testVoice}
            </button>
          </div>
        </section>

        <section className="dashboard-panel dashboard-settings-card">
          <div className="dashboard-panel-heading">
            <div>
              <span>{dictionary.dashboard.alertTypes}</span>
              <h2>{dictionary.dashboard.voiceAlerts}</h2>
            </div>
          </div>
          <div className="dashboard-setting-list">
            <SettingToggle
              label={dictionary.dashboard.trackedOnlineAlert}
              active={alertSettings.trackedOnline}
              onToggle={() => onAlertToggle('trackedOnline')}
            />
            <SettingToggle
              label={dictionary.dashboard.trackedOfflineAlert}
              active={alertSettings.trackedOffline}
              onToggle={() => onAlertToggle('trackedOffline')}
            />
            <SettingToggle
              label={dictionary.dashboard.queueAlert}
              active={alertSettings.queue}
              onToggle={() => onAlertToggle('queue')}
            />
            <SettingToggle
              label={dictionary.dashboard.wipeAlert}
              active={alertSettings.wipe}
              onToggle={() => onAlertToggle('wipe')}
            />
            <SettingToggle
              label={dictionary.dashboard.noteAlert}
              active={alertSettings.notes}
              onToggle={() => onAlertToggle('notes')}
            />
          </div>
        </section>

        <section className="dashboard-panel dashboard-settings-card">
          <div className="dashboard-panel-heading">
            <div>
              <span>{dictionary.dashboard.interfaceSettings}</span>
              <h2>{dictionary.dashboard.settings}</h2>
            </div>
          </div>
          <div className="dashboard-setting-list">
            <SettingToggle
              label={dictionary.dashboard.compactPlayersSetting}
              active={uiSettings.compactPlayers}
              onToggle={() => onUiToggle('compactPlayers')}
            />
            <SettingToggle
              label={dictionary.dashboard.mapLabelsSetting}
              active={uiSettings.mapLabels}
              onToggle={() => onUiToggle('mapLabels')}
            />
            <SettingToggle
              label={dictionary.dashboard.autoOpenTrackedSetting}
              active={uiSettings.autoOpenTracked}
              onToggle={() => onUiToggle('autoOpenTracked')}
            />
          </div>
        </section>

        <section className="dashboard-panel dashboard-pro-panel dashboard-settings-card">
          <div className="dashboard-panel-heading">
            <div>
              <span>{dictionary.dashboard.proSettings}</span>
              <h2>{dictionary.dashboard.proLocked}</h2>
            </div>
            <Lock size={18} aria-hidden />
          </div>
          <p>{dictionary.dashboard.lockedProSetting}</p>
          <div className="dashboard-pro-list settings">
            {[dictionary.dashboard.discordSteamAlerts, dictionary.dashboard.multiServerAlerts, dictionary.dashboard.teamWorkspace].map(
              (feature) => (
                <div key={feature} className="dashboard-pro-card">
                  <span>
                    <Lock size={13} aria-hidden />
                    {feature}
                  </span>
                  <strong>Rustrack Pro</strong>
                  <i />
                  <i />
                </div>
              ),
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function SettingToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button className={active ? 'dashboard-setting-toggle active' : 'dashboard-setting-toggle'} type="button" onClick={onToggle}>
      <span>{label}</span>
      <i aria-hidden />
    </button>
  );
}

function ActivityFeed({
  dictionary,
  server,
  tracked,
}: {
  dictionary: Dictionary;
  server: ServerSummary;
  tracked: GuestTrackedPlayer[];
}) {
  const trackedEvents = tracked
    .filter((player) => player.serverId === server.id)
    .map((player) => ({
      id: `tracked-${player.id}`,
      time: 'Ahora',
      playerName: player.name,
      type: isTrackedOnline(player, server) ? ('connected' as const) : ('disconnected' as const),
    }));
  const events = [...trackedEvents, ...server.activity].slice(0, 6);

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <div>
          <span>{dictionary.dashboard.recentActivity}</span>
          <h2>
            <MessageSquare size={20} aria-hidden />
          </h2>
        </div>
      </div>
      <div className="dashboard-feed">
        {events.map((event) => (
          <p key={event.id}>
            <span>{event.time}</span>
            <strong>{event.playerName}</strong>
            {event.type === 'connected'
              ? dictionary.states.connected
              : dictionary.states.disconnected}
          </p>
        ))}
      </div>
    </section>
  );
}

function ProLockedPanel({ dictionary }: { dictionary: Dictionary }) {
  return (
    <section className="dashboard-panel dashboard-pro-panel">
      <div className="dashboard-panel-heading">
        <div>
          <span>{dictionary.dashboard.proFeatures}</span>
          <h2>{dictionary.dashboard.proLocked}</h2>
        </div>
        <Lock size={18} aria-hidden />
      </div>
      <p>{dictionary.dashboard.proUnlockHint}</p>
      <div className="dashboard-pro-list">
        {dictionary.dashboard.proTeasers.map((feature) => (
          <div key={feature} className="dashboard-pro-card">
            <span>
              <Lock size={13} aria-hidden />
              {feature}
            </span>
            <strong>Rustrack Pro</strong>
            <i />
            <i />
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="dashboard-stat">
      <span>
        <Icon size={15} aria-hidden />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function filterServers(query: string, source: ServerSummary[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return source;

  const results = source.filter((server) =>
    [
      server.name,
      server.description,
      server.ip,
      server.id,
      server.region,
      server.country,
      server.map,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );

  return results.length ? results : source;
}

function isTrackedOnline(player: GuestTrackedPlayer, server: ServerSummary) {
  return (
    player.serverId === server.id &&
    server.connectedPlayers.some((connectedPlayer) => connectedPlayer.id === player.id)
  );
}

function countTrackedOnline(players: GuestTrackedPlayer[], server: ServerSummary) {
  return players.filter((player) => isTrackedOnline(player, server)).length;
}

function isIpOnlyQuery(value: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value.trim());
}

function findBestServer(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return popularServers[1];

  return (
    popularServers.find((server) =>
      [server.name, server.ip, server.id, server.region, server.country]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    ) ?? popularServers[1]
  );
}

function markerColor(tone: 'rust' | 'sky' | 'green' | 'gold') {
  if (tone === 'rust') return 'var(--rt-rust)';
  if (tone === 'sky') return 'var(--rt-sky)';
  if (tone === 'green') return 'var(--rt-green)';
  return 'var(--rt-gold)';
}

function playerInitials(name: string) {
  const cleanName = name.trim();
  if (!cleanName) return '?';
  const chunks = cleanName.split(/[\s_-]+/).filter(Boolean);
  if (chunks.length > 1) return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
  return cleanName.slice(0, 2).toUpperCase();
}

function groupColorFor(group: string) {
  const colors = ['#ff4b22', '#38bdf8', '#32d583', '#f59e0b', '#a78bfa', '#f43f5e'];
  const index = group
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}
