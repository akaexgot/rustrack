# Coolify

## Nixpacks

Use Nixpacks with:

- Build command: `npm run build`
- Start command: `HOST=0.0.0.0 PORT=$PORT node ./dist/server/entry.mjs`

## Required environment variables

```text
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_APP_URL=
PUBLIC_DEFAULT_LOCALE=es
PUBLIC_ENABLE_MOCK_BATTLEMETRICS=false
BATTLEMETRICS_API_KEY=
```

`BATTLEMETRICS_API_KEY` is optional for the first public endpoints. Keep it
server-only if BattleMetrics rate limits or private endpoints require it later.
