# Rustrack

Rustrack is a bilingual SaaS dashboard for Rust players: server lookup,
temporary guest tracking, persisted user intelligence, collaborative wipes and
voice/push alert foundations.

## Current phase

Phase 2 foundation:

- Astro 7 with strict TypeScript.
- React islands for interactive app surfaces.
- Tailwind CSS 4.
- Supabase client prepared through typed environment variables.
- Spanish and English dictionaries.
- PWA manifest and service worker setup through Vite PWA.
- First dashboard and login surfaces.
- Docker, Nixpacks and Coolify notes.

Steam auth is intentionally postponed. Google and email/password are prepared
through Supabase Auth once the Supabase project is created.

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
with public BattleMetrics endpoints and move the key into Edge Functions only if
rate limits or private endpoints require it.

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
