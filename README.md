# Quizbo

A personalised AI study app for students. The centre of it is a real-time **1v1 MCQ battle** —
validated questions, 12 seconds each, health bars, streaks and ELO matchmaking. Around it: a
4-question **onboarding** that personalises the experience, a **post-battle breakdown** that finds your
weak sub-topic, a **coach** that explains misses and turns your notes into cards, and a
**conversational planner** that turns "physics term 2 is on the 18th" into a deterministic study
schedule that reads your mastery.

Built from the design handoff (`README.md` + `product-spec/`) on the Industry design system.

## Architecture

```
            browser ──────────── HTTPS ───────────────►  apps/web  (Next.js 16, Auth.js, API routes)
               │                                            │  reads/writes
               └──── WebSocket (signed battle token) ──►  apps/battle  (Socket.io; Redis to scale)
                                                            │  writes battles, ELO, mastery
                                                            ▼
                              PostgreSQL  ◄────────────  apps/worker  (BullMQ on Redis:
                                                            nightly questions, re-plan,
                                                            AI resource finder)
```

The battle service and the planner never call each other; they meet only in the database
(`mastery` is written by battles and read by the scheduler), exactly as `architecture.md` §1 describes.

| Workspace | What it is |
| --- | --- |
| `packages/core` | Pure, I/O-free logic with unit tests: ELO, matchmaking bands, battle scoring, derangement question orders, mastery, sub-topic breakdown, **deterministic scheduler**, skip rebalancing, extraction parsing, fuzzy topic matching, streaks, and the socket event contract. |
| `packages/db` | Prisma 7 schema + migrations, the seed curriculum (72 hand-checked questions), the JEE study library (`src/content/jee.ts`: full Physics / Chemistry / Maths syllabus with verified free links plus official exam sites), and planner services (confirm exam, re-plan, skip). |
| `packages/ai` | Narrow Gemini calls (Google Gen AI SDK), each with its prompt and output schema documented beside it: question generation, blind validation, weak-spot analysis, planner extraction, coach, resource finder. Every call has a fallback. |
| `apps/web` | Next.js app: dashboard, matchmaking/battle UI, breakdown + review, planner, progress tab (ELO over time, topic mastery; also `/api/progress`), resource library, coach drawer, onboarding, auth. |
| `apps/battle` | Socket.io battle service: invite rooms, ELO-band matchmaking, timed rounds, reconnect grace period, forfeits, boosts, persistence; runs as one instance or several sharing Redis. Event reference at the top of `src/server.ts`. |
| `apps/worker` | BullMQ worker and a Redis-free CLI for the question pipeline and nightly re-optimisation. |

## The rules this code enforces

- **Battles only serve `validated = true` questions.** Generation is offline; a separately prompted
  reviewer solves each question blind and must reach the stored answer key before it can be served.
- **The LLM never schedules.** Planner extraction returns JSON only; `generateStudySessions` is a pure function.
- **Nothing from the planner chat is written until you confirm that card.** Drafts live in the chat
  payload, never in `exams`.
- **ELO (per subject) and mastery (per topic) are separate.**
- **Room state is keyed by `userId`**, taken from a signed token — never `socket.id`.
- **A dropped connection pauses the match for 20 seconds** (server timer stops, clients freeze their
  countdown, the round restarts with a fresh full timer) before it becomes a forfeit.
- **Boosts are applied by the server.** Each player is dealt 3 of the 10 boosts (`packages/core/src/boosts.ts`)
  and may fire one per question, before answering. The battle service applies every effect; the client only animates it.

## Run it locally

Requirements: Node 22.12+ (24 works). No Docker needed.

```bash
npm install
npm run db:local          # starts a local PostgreSQL on :54329 (first run downloads it; no Docker)
cp .env.example .env      # set DATABASE_URL, AUTH_SECRET, BATTLE_JWT_SECRET (see comments)
npm run db:deploy         # apply migrations
SEED_DEMO_DATA=true npm run db:seed
npm run dev               # web on :3000, battle service on :4000
```

Open http://localhost:3000, sign in with a demo name, answer the four onboarding questions, and
open a second browser profile to battle yourself (or use **Invite a friend** and the room code).

No second player handy? The dev-only sparring partner joins your room or the queue, answers
at a chosen accuracy and fires boosts at a chosen rate:

```bash
npm run sparring -w @quizbo/battle -- --room AB3XQ --accuracy 0.6 --boosts 0.7
```

Set `GEMINI_API_KEY` (free from https://aistudio.google.com/apikey; model `gemini-3.8-flash` by default) to
turn on the coach, planner extraction and AI weak-spot analysis. `npm run smoke -w @quizbo/ai` checks the key. Without
it the app still runs: the planner offers manual exam cards and the breakdown uses a deterministic
paragraph.

### Useful scripts

| Command | Does |
| --- | --- |
| `npm test` | Unit tests (core, ai) + battle service integration tests (real sockets). |
| `npm run typecheck` | Type-checks every workspace. |
| `npm run questions:pipeline -- status` | Validated / waiting / rejected questions per topic (no API key needed). |
| `npm run questions:pipeline -- fill --min 10` | **Make every topic battle-ready**: generate, blind-review, repeat until each topic has 10 validated questions. Safe to stop and re-run. Needs `GEMINI_API_KEY`. |
| `npm run questions:pipeline -- resources --topics 10` | AI resource finder: suggests study pages for the weakest topics, keeps only links that load and mention the topic. |
| `npm run questions:pipeline -- generate --subject physics-12 --count 6` | Generate unvalidated questions offline. |
| `npm run questions:pipeline -- validate --limit 50` | Blind AI review; passing questions become battle-eligible. |
| `npm run questions:pipeline -- spot-check --sample 10` | Print a random sample for a human reviewer. |
| `npm run questions:pipeline -- replan` | Re-run the scheduler for every student with an upcoming exam. |
| `npm run resources:check -w @quizbo/db` | Re-fetch every study link and check each page still has the expected content; exits 1 on a broken link. |
| `npm run db:migrate -- --name <change>` | Create a new migration while developing. |

## Troubleshooting

**`PrismaClientKnownRequestError` / `ECONNREFUSED` on any page** — the local database isn't running
(it doesn't survive a reboot). `npm run dev` starts it automatically, so restart `npm run dev`. To start
or stop it on its own:

```bash
npm run db:local
npm run db:stop
```

Data lives in `.local/postgres` and survives restarts; the server log is `.local/postgres.log`.

**Errors mention a table that "does not exist"**: the database is empty. `npm run dev` applies migrations
and reloads the seed data automatically; to do it by hand:

```bash
npm run db:deploy
SEED_DEMO_DATA=true npm run db:seed
```

**"The coach is offline" / planner asks for manual cards** — no `GEMINI_API_KEY` in `.env`. Check with
`npm run smoke -w @quizbo/ai`.

**Ports 3000 or 4000 already in use** — another `npm run dev` is still running; close it first.

## Deploy

See **[DEPLOY.md](DEPLOY.md)** — Vercel + Fly/Render + Neon + Upstash, a one-click Render Blueprint,
or `docker compose up` for self-hosting. Decisions and additions beyond the spec are listed in
**[ASSUMPTIONS.md](ASSUMPTIONS.md)**.
