# Deploying Quizbo

Quizbo is three processes and two data stores:

| Piece | Needs | Why |
| --- | --- | --- |
| `apps/web` (Next.js) | Serverless is fine | Pages, auth, non-realtime API routes |
| `apps/battle` (Socket.io) | A **long-lived** process; one instance, or several with `BATTLE_REDIS_URL` | WebSockets and live rooms |
| `apps/worker` (BullMQ) | A background process + Redis | Nightly question bank top-up and re-plan (optional) |
| PostgreSQL | Managed Postgres | Everything durable |
| Redis | For the worker, and for the battle service when it runs several instances | BullMQ queue; shared rooms and matchmaking |

## Environment variables

| Variable | web | battle | worker | Notes |
| --- | :-: | :-: | :-: | --- |
| `DATABASE_URL` | ✓ | ✓ | ✓ | Postgres connection string. Use the pooled URL on serverless (Neon: `-pooler` host). |
| `AUTH_SECRET` | ✓ | | | `npx auth secret` |
| `AUTH_TRUST_HOST` | ✓ | | | `true` behind a proxy/platform |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | ✓ | | | Optional. Redirect URI: `https://<web>/api/auth/callback/google` |
| `AUTH_RESEND_KEY` / `AUTH_EMAIL_FROM` | ✓ | | | Optional magic-link email via Resend (verified sending domain) |
| `AUTH_DEMO_LOGIN` | ✓ | | | `true` enables name-only demo accounts. Turn **off** for a real launch once Google or email works. |
| `BATTLE_JWT_SECRET` | ✓ | ✓ | | **Same value** on both. Long random string. |
| `NEXT_PUBLIC_BATTLE_URL` | ✓ (build) | | | Public URL of the battle service, baked in at build time |
| `BATTLE_INTERNAL_URL` | optional | | | Private URL the web server uses for the live queue count |
| `WEB_ORIGIN` | | ✓ | | Comma-separated origins allowed to open sockets |
| `GEMINI_API_KEY` | ✓ | | ✓ | Optional; enables coach, extraction, analysis, question pipeline. Get one at https://aistudio.google.com/apikey |
| `QUIZBO_GEMINI_MODEL` | ✓ | | ✓ | Defaults to `gemini-3.8-flash` (newest model with a free tier) |
| `REDIS_URL` | | | ✓ | `rediss://` supported (Upstash) |
| `BATTLE_REDIS_URL` | | optional | | Set to run several battle instances (shared rooms + queue). Can be the same Redis as `REDIS_URL`. |
| `QUIZBO_AI_PACE_MS` | | | optional | Pause between AI calls in batch jobs (default 4500; 6000 suits the free tier, 0 a paid key) |
| `QUIZBO_GEN_EFFORT` | | | optional | Reasoning depth for question generation: `high` (default) writes the best questions, `medium` is accepted more often when the free tier is busy |
| `NEXT_PUBLIC_FISTS_VIDEO_URL` / `..._POSTER_URL` | ✓ (build) | | | Self-hosted ASCII loop (see checklist) |
| `DATABASE_POOL_MAX` | optional | optional | optional | Default 10; use 1–3 on serverless |

## Option A — recommended split (matches `stack.md`)

**Postgres: Neon** (or Supabase). Create a database, copy the pooled connection string.

**Battle service: Fly.io** (or Railway/Render):

```bash
fly launch --no-deploy --copy-config --config deploy/fly.battle.toml
fly secrets set DATABASE_URL="…" BATTLE_JWT_SECRET="…" WEB_ORIGIN="https://quizbo.example.com" --config deploy/fly.battle.toml
fly deploy --config deploy/fly.battle.toml
fly scale count 1 --config deploy/fly.battle.toml
```

**Web: Vercel.** Import the repo, set **Root Directory** to `apps/web` (the included `vercel.json`
installs and builds from the monorepo root). Add the web variables above, with
`NEXT_PUBLIC_BATTLE_URL=https://quizbo-battle.fly.dev`. Set `DATABASE_POOL_MAX=3`.

**Migrations:** Vercel doesn't run them. Either run locally —

```bash
DATABASE_URL="<neon url>" npm run db:deploy && DATABASE_URL="<neon url>" npm run db:seed
```

— or add a `PRODUCTION_DATABASE_URL` secret and run the **Migrate production database** GitHub workflow.

**Worker (optional): Upstash Redis + Fly/Render worker** with `DATABASE_URL`, `REDIS_URL`,
`GEMINI_API_KEY`. Without it, run `npm run questions:pipeline -- pipeline` by hand.

## Option B — everything on Render

`render.yaml` is a Blueprint: Postgres, Redis, web, battle (1 instance) and worker. In Render,
**New → Blueprint**, pick the repo, then fill the prompted values:
`NEXT_PUBLIC_BATTLE_URL` (the battle service URL), `WEB_ORIGIN` (the web URL) and
`GEMINI_API_KEY`. Migrations and the seed run as the web service's pre-deploy command.

## Option C — self-host with Docker

```bash
cp .env.example .env    # set AUTH_SECRET and BATTLE_JWT_SECRET at minimum
docker compose up --build
```

Postgres, Redis, migrations + seed, web (:3000), battle (:4000) and worker all start. Put a TLS reverse
proxy in front, and rebuild `web` with `NEXT_PUBLIC_BATTLE_URL` set to the public battle URL.

## Launch checklist

- [ ] **Self-host the ASCII fists loop.** The defaults hot-link the client's files on `assets.21st.dev`.
      Put the MP4 and WebP in `apps/web/public/media/` (or a CDN) and set
      `NEXT_PUBLIC_FISTS_VIDEO_URL` / `NEXT_PUBLIC_FISTS_POSTER_URL`.
- [ ] **Have an educator spot-check the question bank** — `npm run questions:pipeline -- spot-check --sample 20`.
      The seed questions are hand-written with worked answer keys but have not had a teacher's review.
      Optionally re-run them through the blind AI review: `… validate --source seed --revalidate`.
- [ ] Configure Google and/or email sign-in, then set `AUTH_DEMO_LOGIN=false`.
- [ ] **Move Gemini to a paid (billing-enabled) key before real students use it.** On the free tier Google may use
      prompts and responses — here, student chat messages and uploaded notes — to improve its products. Free-tier
      rate limits are also low for a class-sized load.
- [ ] Battle service: one instance, or several **with `BATTLE_REDIS_URL` set on all of them**; `WEB_ORIGIN` matches the web domain.
- [ ] `BATTLE_JWT_SECRET` identical on web and battle.
- [ ] `https://<battle>/healthz` returns `{"ok":true}`; the dashboard shows "N in queue now" rather than "queue offline".
- [ ] Do **not** set `SEED_DEMO_DATA=true` in production (it adds five fake leaderboard players).

## Scaling the battle service

One small instance handles hundreds of concurrent battles. To run more (or to survive restarts
without dropping the queue), set `BATTLE_REDIS_URL` on every battle instance and raise the instance
count:

- Each room lives on the instance that created it; its players can be connected to any instance.
  Their events are forwarded to the owner, and messages to them go through the Socket.io Redis adapter.
- Room owners, each user's current room and the matchmaking queue are kept in Redis. One instance at a
  time holds the matchmaker lease and pairs players from the shared queue.
- Entries expire 90 s after their instance stops refreshing them, so a crashed instance can't leave
  players stuck "already in a battle". Battles running on a crashed instance are lost (not rated).
- The browser connects with WebSocket first. If your platform only offers long-polling, enable sticky
  sessions on the load balancer.
- `/healthz` reports the instance id and its rooms; the queue count comes from the instance that
  currently runs matchmaking.

Tested in `apps/battle/src/cluster.test.ts` (two instances in one process sharing a message bus and a
registry) and `registry.test.ts` (the Redis registry against a Redis mock).
