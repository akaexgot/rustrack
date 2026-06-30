import { ArrowRight, Loader2, Search, Server } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { searchRustServers } from '@/lib/battlemetrics/client';
import type { ServerSummary } from '@/lib/battlemetrics/types';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { localizedPath } from '@/lib/i18n/routing';

type Props = {
  locale: Locale;
  dictionary: Dictionary;
};

const examples = ['185.189.255.130:10000', 'Magic Rust #22', '30078480'];

export default function HomeSearch({ locale, dictionary }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ServerSummary[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const cleanQuery = query.trim();
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;

    if (cleanQuery.length < 2) {
      setSuggestions([]);
      setIsSuggesting(false);
      setSuggestionError(false);
      return;
    }

    setIsSuggesting(true);
    setSuggestionError(false);

    const timeoutId = window.setTimeout(() => {
      searchRustServers(cleanQuery, 6)
        .then((results) => {
          if (requestId.current !== nextRequestId) return;
          setSuggestions(results);
        })
        .catch(() => {
          if (requestId.current !== nextRequestId) return;
          setSuggestions([]);
          setSuggestionError(true);
        })
        .finally(() => {
          if (requestId.current === nextRequestId) setIsSuggesting(false);
        });
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  function submitSearch(value = query) {
    const cleanQuery = value.trim();
    if (!cleanQuery) return;

    window.location.href = `${localizedPath(locale, '/dashboard')}?q=${encodeURIComponent(cleanQuery)}`;
  }

  function openServer(server: ServerSummary) {
    window.location.href = `${localizedPath(locale, '/dashboard')}?q=${encodeURIComponent(server.id)}`;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="home-search-combobox">
        <form
          className="home-search-shell group"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <Search className="home-search-icon" size={22} aria-hidden />
          <input
            className="home-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.home.searchPlaceholder}
            autoComplete="off"
            autoFocus
          />
          <button className="home-search-button" type="submit">
            <span>{dictionary.home.searchButton}</span>
            <ArrowRight size={18} aria-hidden />
          </button>
        </form>

        {query.trim().length >= 2 ? (
          <div className="home-suggestions">
            <div className="home-suggestions-heading">
              <span>{dictionary.home.suggestionsTitle}</span>
              {isSuggesting ? <Loader2 size={15} aria-hidden /> : null}
            </div>
            {suggestionError ? <p>{dictionary.home.suggestionsError}</p> : null}
            {!suggestionError && !isSuggesting && !suggestions.length ? (
              <p>{dictionary.home.noSuggestions}</p>
            ) : null}
            {suggestions.map((server) => (
              <button key={server.id} type="button" onClick={() => openServer(server)}>
                <span>
                  <Server size={15} aria-hidden />
                  <strong>{server.name}</strong>
                </span>
                <small>
                  {server.ip}:{server.port} / {server.players}/{server.maxPlayers} /{' '}
                  {dictionary.dashboard.queue} {server.queue}
                </small>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-white/58">
        <span>{dictionary.home.examples}</span>
        {examples.map((example) => (
          <button
            key={example}
            className="rounded-md border border-white/12 bg-white/[0.06] px-3 py-2 text-white/76 transition hover:border-[#ff4b22]/45 hover:bg-[#ff4b22]/12 hover:text-white"
            type="button"
            onClick={() => submitSearch(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
