# Rustrack

Rustrack is a bilingual SaaS dashboard for Rust players: server lookup,
temporary guest tracking, persisted user intelligence, collaborative wipes and
voice/push alert foundations.

## Current phase

Phase 3 hardening:

- Astro 7 with strict TypeScript and React islands for interactive surfaces.
- Supabase Auth with email/password and Google OAuth entry points.
- Supabase schema, RLS, grants, default user intelligence and dashboard settings.
- Guest mode keeps all tracking in memory.
- Registered users persist favorites, tracked players, notes, tags and dashboard settings.
- BattleMetrics is accessed through an internal server API with short-lived cache and basic rate limiting.
- RustMaps proxy with HTTP cache headers.
- Spanish and English dictionaries.
- PWA manifest and service worker setup through Vite PWA.
- Docker, Nixpacks and Coolify deployment files.

Steam auth is intentionally postponed until the first registered-user workflow is stable.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Fill these variables when the Supabase project exists:

```text
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

`BATTLEMETRICS_API_KEY` is optional for now. The first integration should start
with public BattleMetrics endpoints through the internal API proxy and move the
key into server/Edge Function secrets only if rate limits or private endpoints
require it.

## Supabase

Run migrations in order:

```text
supabase/migrations/0001_core_schema.sql
supabase/migrations/0002_phase_2_3_hardening.sql
```

`0002_phase_2_3_hardening.sql` is required for PostgREST grants, user settings
and default tags/groups on new profiles.

## Scripts

- `npm run dev`: local development.
- `npm run build`: production build.
- `npm run preview`: preview built output.
- `npm run check`: Astro and TypeScript checks.
- `npm run lint`: ESLint.
- `npm run format`: Prettier.

## Routes

- `/es/dashboard`
- `/en/dashboard`
- `/es/auth/login`
- `/en/auth/login`

## Deployment

Use `nixpacks.toml` for Coolify/Nixpacks or the included `Dockerfile`.
