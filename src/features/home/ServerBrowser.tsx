import { Loader2, Search, Server } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getPopularRustServers, searchRustServers } from '@/lib/battlemetrics/client';
import type { ServerSummary } from '@/lib/battlemetrics/types';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { localizedPath } from '@/lib/i18n/routing';

type Props = {
  locale: Locale;
  dictionary: Dictionary;
};

export default function ServerBrowser({ locale, dictionary }: Props) {
  const [query, setQuery] = useState('');
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const title = useMemo(
    () => (query.trim() ? dictionary.home.browseResults : dictionary.home.browsePopular),
    [dictionary.home.browsePopular, dictionary.home.browseResults, query],
  );

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(false);

    const timeoutId = window.setTimeout(
      () => {
        const request = query.trim()
          ? searchRustServers(query, 12)
          : getPopularRustServers(12);

        request
          .then((results) => {
            if (!active) return;
            setServers(results);
          })
          .catch(() => {
            if (!active) return;
            setServers([]);
            setError(true);
          })
          .finally(() => {
            if (active) setIsLoading(false);
          });
      },
      query.trim() ? 300 : 0,
    );

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  function openServer(server: ServerSummary) {
    window.location.href = `${localizedPath(locale, '/dashboard')}?q=${encodeURIComponent(server.id)}`;
  }

  return (
    <section className="home-browser">
      <div className="home-browser-heading">
        <div>
          <p className="home-eyebrow">{dictionary.home.browseEyebrow}</p>
          <h2>{dictionary.home.browseTitle}</h2>
          <span>{dictionary.home.browseDescription}</span>
        </div>
        <label className="home-browser-search">
          <Search size={17} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.home.browsePlaceholder}
          />
        </label>
      </div>

      <div className="home-browser-subhead">
        <strong>{title}</strong>
        {isLoading ? <Loader2 size={16} aria-hidden /> : null}
      </div>

      {error ? <p className="home-browser-empty">{dictionary.home.suggestionsError}</p> : null}
      {!error && !isLoading && !servers.length ? (
        <p className="home-browser-empty">{dictionary.home.noSuggestions}</p>
      ) : null}

      <div className="home-server-grid">
        {servers.map((server) => (
          <button key={server.id} type="button" onClick={() => openServer(server)}>
            <span>
              <Server size={16} aria-hidden />
              {server.name}
            </span>
            <strong>
              {server.players}/{server.maxPlayers}
            </strong>
            <small>
              {server.ip}:{server.port} / {dictionary.dashboard.queue} {server.queue}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
