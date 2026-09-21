# Quizbo

[![Live Demo](https://img.shields.io/badge/Live%20Demo-quizbo--web.onrender.com-0A2463?style=for-the-badge&logo=render&logoColor=white)](https://quizbo-web.onrender.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?style=for-the-badge&logo=socket.dot.io)](https://socket.io/)
[![Prisma 7](https://img.shields.io/badge/Prisma-7.10-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%20Flash-4285F4?style=for-the-badge&logo=google-gemini)](https://aistudio.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444?style=for-the-badge&logo=turborepo)](https://turbo.build/)

> **A personalised AI study platform built around real-time 1v1 MCQ battles, a conversational study planner with deterministic scheduling, an interactive AI coach, and deep performance analytics.**

The platform is designed on the Industry design system with a high-contrast palette (Imperial Blue, Blue Bell, Ghost White, Magenta Bloom, and Carbon Black), fluid responsive layouts, micro-animations, and server-authoritative real-time game mechanics.

---

### 🌐 Live Deployment & Verification

- **Live Web App**: **[https://quizbo-web.onrender.com/](https://quizbo-web.onrender.com/)**
- **Live QA & Verification Report**: **[OBSERVATIONS.md](OBSERVATIONS.md)** *(Comprehensive test log covering live auth, 1v1 battles, NLP planner extraction, progress charts, and AI coach)*
- **Production Runbook & Setup**: **[DEPLOY.md](DEPLOY.md)**
- **Architectural Decisions & Schema Additions**: **[ASSUMPTIONS.md](ASSUMPTIONS.md)**

---

## 🎯 The Problem

Students preparing for high-stakes examinations (such as JEE Main & NEET) face a fragmented workflow:
1. **Planning is disconnected from practice**: Study schedules are static calendar blocks that don't adapt when a student struggles with specific sub-topics.
2. **Practice is passive and isolated**: Standard MCQ question banks lack urgency, real-time engagement, and competitive stakes.
3. **LLMs are unconstrained when used directly**: Generic AI assistants hallucinate impossible study timetables, misjudge time constraints, or generate flawed quiz questions with incorrect answer keys when prompted live.
4. **Feedback is delayed**: Students rarely get immediate, actionable diagnostics pinpointing exactly which conceptual sub-topic caused a mistake during practice.

---

## 💡 The Solution

Quizbo unifies exam preparation into a **closed-loop, adaptive learning system**. 

Rather than relying on unconstrained LLM outputs, Quizbo enforces a fundamental engineering boundary: **AI is used strictly for natural-language extraction and conceptual analysis, while pure deterministic application logic controls scheduling, scoring, ELO ratings, and question validation.**

```text
Student sets exam goals conversationally
        │
        ▼
Google Gemini extracts structured JSON intent (subjects, topics, deadlines)
        │
        ▼
Deterministic Pure Scheduler computes calendar distribution (daily time budgets, exam urgency)
        │
        ▼
Student completes scheduled study sessions & practice blocks
        │
        ▼
Real-Time 1v1 MCQ Battles test mastery under time pressure (12s rounds, tactical boosts)
        │
        ▼
Topic Mastery updates via Exponential Moving Average (EMA)
        │
        ▼
AI Coach & Breakdown diagnose conceptual weak spots
        │
        ▼
Scheduler auto-rebalances upcoming study sessions & injects battle check-ins
```

---

## 🔄 The Quizbo Learning Loop

```mermaid
flowchart LR
    A[🎯 Set Exam Goals] --> B[🧠 AI Entity Extraction]
    B --> C[⚙️ Deterministic Scheduler]
    C --> D[📖 Study Sessions & Resources]
    D --> E[⚔️ 1v1 Real-Time Battle]
    E --> F[📊 Performance Breakdown]
    F --> G[📈 Topic Mastery Update]
    G --> C
```

---

## 🚀 Why Quizbo Is Different

- **Server-Authoritative Real-Time Combat**: 1v1 battles run on synchronized Socket.io nodes. Timers, answer evaluations, damage calculations, and tactical boosts are computed strictly on the server.
- **Deterministic Scheduling vs. LLM Hallucinations**: Gemini extracts structured exam details from natural language, but pure mathematical algorithms allocate study slots, enforce daily minute caps, and rebalance skipped sessions.
- **Offline Blind-Validated Question Bank**: Live battles *never* serve unvalidated questions. Questions are generated offline and must pass a multi-pass blind review where an independent AI reviewer solves the question without an answer key.
- **Decoupled ELO & Topic Mastery**: ELO tracks competitive skill per subject for matchmaking; Exponential Moving Average (EMA) topic mastery tracks conceptual understanding to drive the study scheduler.
- **Derangement Question Permutations**: Both players battle on the same topic simultaneously, but derangement algorithms guarantee neither player sees the same question in the same round.
- **Resilient Connection Handling**: Disconnected sockets enter a 20-second grace window that freezes the server timer and restarts the current round upon reconnection.
- **Integrated JEE Study Library**: 128 curated textbook and concept links across 65 topics in Physics, Chemistry, and Mathematics, verified via automated link integrity assertion tests.

---

---

## 🖼️ Interface Showcase

> *Add full-resolution screenshots of the key interfaces to the `docs/screenshots/` folder.*

| Interface | Description & Key Elements to Capture | Screenshot Location |
| :--- | :--- | :---: |
| **Student Dashboard** | Weekly leaderboard rank (`#2 You (1275 ELO)`), matchmaking launchpad with countdown rules, subject switcher modal, and curated loot drops. | `![Student Dashboard](docs/screenshots/dashboard.png)` |
| **1v1 Battle Arena** | Real-time combat HUD showing synchronized 100 HP health bars, 12s round timer countdown, streak multipliers, and tactical boost bar. | `![1v1 Battle Arena](docs/screenshots/battle_arena.png)` |
| **Conversational Study Planner** | Natural language chat input (*"Physics midterm on 28th October..."*), extracted draft confirmation card, and generated 7-day study session calendar grid. | `![Study Planner](docs/screenshots/planner.png)` |
| **Progress & Analytics Hub** | ELO rating trajectory chart over time per subject, Exponential Moving Average (EMA) topic mastery matrix, and weekly rhythm heatmap. | `![Progress Analytics](docs/screenshots/progress.png)` |
| **Curated Study Library** | JEE Main syllabus browser with search filter, OpenStax / HyperPhysics verified textbook links, and one-click *"BATTLE THIS →"* action chips. | `![Curated Resources](docs/screenshots/resources.png)` |
| **AI Coach Drawer** | Side drawer overlay with contextual weakness diagnostics, study advice chips, and PDF/note upload dropzone. | `![AI Coach Drawer](docs/screenshots/coach_drawer.png)` |

---

## ✨ Key Features

### ⚔️ Real-Time 1v1 Battle Arena (`apps/battle`)
High-stakes synchronous MCQ matches designed to test conceptual speed and precision under tournament conditions.

<!-- SCREENSHOT PLACEHOLDER: 1v1 Battle Arena Interface -->
<!-- Interface to capture: Active battle round on /play with 12s timer, question prompt, 4 options, HP bars, streak indicator, and armed boost -->
<!-- ![1v1 Battle Arena](docs/screenshots/battle_arena.png) -->

- **12-Second Rapid Fire Rounds**: Synchronized 100 HP health bars, speed bonuses (+100 base score + bonus under 4s), and consecutive correct answer streak multipliers.
- **Deranged Question Orders**: Both players compete in real time, but deranged question and option orders prevent screen-peeking and ensure fair rounds.
- **10 Tactical Boosts**: Each player is dealt 3 random boosts per match (*Bubble Shield*, *Double Tap*, *Fifty-Fifty*, *Time Warp*, *Med Kit*, *Mirror Coat*, *Streak Anchor*, *Vampire Bite*, *Ink Splat*, *Overclock*), resolved server-side.
- **Dynamic Matchmaking & Private Rooms**: Automated ELO-band matchmaking with progressive search expansion, plus instant 5-character room codes (e.g. `Y6D8K`) for direct friend invites.
- **Disconnect Grace Period**: 20-second pause buffer allows players to recover from network drops without forfeiting. Rage-quits trigger immediate forfeits without harming fair play.

### 🧠 Conversational NLP Study Planner (`packages/db`, `packages/core`, `packages/ai`)
Turns natural language exam announcements into an optimized, constraint-aware study timetable.

<!-- SCREENSHOT PLACEHOLDER: Conversational Planner & Calendar -->
<!-- Interface to capture: /planner view showing chat intake thread with confirmed exam draft card alongside the weekly calendar grid of scheduled sessions -->
<!-- ![Conversational Study Planner](docs/screenshots/planner.png) -->

- **Natural Language Intake**: Students describe upcoming exams conversationally (e.g. *"Physics midterm on 28th October covering Optics and Electrostatics"*).
- **Draft Confirmation Gate**: Google Gemini extracts subject, target date, and topics into an uncommitted draft card, giving the student full review and edit control before database creation.
- **Pure Deterministic Scheduling**: `generateStudySessions()` allocates sessions day-by-day, respects daily time budgets (e.g. 45 min/day), weights exam priorities, handles session skips with automatic rebalancing, and injects battle check-ins for low-mastery topics (<50%).

### 📚 Curated JEE Study Library & AI Resource Finder (`/resources`)
A comprehensive, verified study repository aligned with the official JEE Main & Advanced syllabus.

<!-- SCREENSHOT PLACEHOLDER: JEE Study Library -->
<!-- Interface to capture: /resources view showing topic search filter ("Optics"), verified OpenStax/HyperPhysics textbook links, and "BATTLE THIS ->" buttons -->
<!-- ![Curated Resources Library](docs/screenshots/resources.png) -->

- **128 Verified Free Resources**: Curated across 65 syllabus topics in Class 11–12 Physics, Chemistry, and Mathematics from OpenStax University Physics, HyperPhysics, NCERT textbook PDFs, and official NTA examination portals.
- **Real-Time Search & Direct Launch**: Search topics instantly with direct *"BATTLE THIS →"* action buttons to launch targeted matchmaking lobbies for specific sub-topics.
- **Automated Verification Pipeline**: Built-in script (`npm run resources:check -w @quizbo/db`) asserts that all external study links remain live and contain required conceptual phrases.

### 🤖 Personal AI Coach & Note Ingestion (Coach Drawer)
A contextual tutor overlay assisting students across their entire learning journey.

<!-- SCREENSHOT PLACEHOLDER: AI Coach Drawer -->
<!-- Interface to capture: Coach side drawer open over the dashboard showing study path recommendation chips and PDF/note upload target -->
<!-- ![Personal AI Coach](docs/screenshots/coach_drawer.png) -->

- **Persistent Side Drawer**: Accessible across every page via the top navigation *ASK COACH* button.
- **Conceptual Diagnostics & Study Advice**: Explains post-battle missed questions and provides targeted study recommendations via quick prompt chips.
- **Document & Note Processing**: Upload PDF or text notes up to 4MB; the coach extracts structured summary cards directly into saved Quick Notes.

### 📊 Deep Analytics & Progress Tracking (`/progress`)
Transparent visualization of competitive rating trajectory and cognitive mastery over time.

<!-- SCREENSHOT PLACEHOLDER: Progress & Analytics Dashboard -->
<!-- Interface to capture: /progress view showing ELO rating trajectory curve, total battle stats, win rate %, and sub-topic mastery matrix -->
<!-- ![Progress & Analytics](docs/screenshots/progress.png) -->

- **ELO Rating Timeline**: Interactive SVG charts showing rating changes per subject across battle history with expandable tabular logs.
- **Sub-Topic Mastery Matrix**: Visual breakdown of mastery percentages calculated via Exponential Moving Averages across recent battle attempts.
- **Weekly Rhythm Heatmap**: Tracks study consistency, completed sessions, and streak counts.

### 🎮 Gamification & Easter Eggs
Interactive achievements engine tracking 8 hidden triggers:
- **Konami Code** (Party Mode)
- **7-Click Q Logo** (Barrel Roll)
- **5 Rapid Theme Toggles** (Disco Mode)
- **Typing "quizbo"** (Rainbow Wave)
- **Late-Night Sessions (00:00–04:00)** (Night Owl Badge)
- **Sub-1s Answers** (Lightning Badge)
- **100 HP Victories** (Flawless Win)
- **≤10 HP Victories** (Clutch Win)

---

## 🧠 How AI Is Used

Quizbo deliberately separates **AI-powered natural language interpretation** from **deterministic application execution**:

```text
                 ┌──────────────────────────────────┐
                 │       Student's Chat Input       │
                 │   ("Physics exam on 28th...")    │
                 └────────────────┬─────────────────┘
                                  │
                                  ▼
                 ┌──────────────────────────────────┐
                 │         Google Gemini AI         │
                 │  (Extraction, Analysis, Coach)   │
                 └────────────────┬─────────────────┘
                                  │
                                  ▼
                 ┌──────────────────────────────────┐
                 │     Structured JSON Payload      │
                 │     (Strict Zod Validation)      │
                 └────────────────┬─────────────────┘
                                  │
                                  ▼
                 ┌──────────────────────────────────┐
                 │    Deterministic Core Engine     │
                 │  • Pure Study Session Scheduler  │
                 │  • Server Battle State & Damage  │
                 │  • ELO & Mastery Moving Averages │
                 └──────────────────────────────────┘
```

### The 5 AI Touchpoints
1. **Conversational Exam Intake** (`packages/ai/src/planner-extraction.ts`): Extracts subject, target dates, chapter units, and priorities into a structured JSON schema.
2. **Offline Question Generation** (`packages/ai/src/question-generation.ts`): Generates 4-option MCQs with explanations, difficulty ratings, and curriculum topic bindings.
3. **Blind Multi-Pass Question Validator** (`packages/ai/src/question-validation.ts`): An independent reviewer model solves generated questions without seeing the answer key; passing questions become battle-eligible (`validated = true`).
4. **Weak-Spot Diagnostic Analysis** (`packages/ai/src/analysis.ts`): Analyzes battle answer telemetry to produce concise, diagnostic weakness explanations.
5. **AI Coach & Note Ingestor** (`packages/ai/src/coach.ts`): Answers student queries and transforms uploaded notes/PDFs into flashcard notes.

---

## 🛡️ Reliability & Design Principles

- **Validated Questions Only**: Battles only serve questions verified through blind AI review or educator spot-checks.
- **The LLM Never Schedules**: Calendar allocations are computed mathematically, ensuring zero hallucinated dates or conflicting slots.
- **Explicit Confirmation on Exam Drafts**: Drafts remain in chat payloads until explicitly confirmed by the student.
- **Decoupled ELO & Topic Mastery**: Skill rating and knowledge mastery are maintained separately.
- **Signed JWT User Identity**: Sockets authenticate via signed tokens (`userId`), making sessions immune to socket reconnect churn.
- **Server-Authoritative Combat**: All gameplay rules, timers, and boost effects execute on the server.

---

## 🏗️ Architecture

```
                               ┌────────────────────────┐
                               │   Browser (Next.js)    │
                               └───────┬────────┬───────┘
                                       │        │
                     HTTPS / Server    │        │ WebSocket
                     Actions / Auth    │        │ (Signed JWT)
                                       ▼        ▼
                      ┌──────────────────┐    ┌──────────────────────────┐
                      │     apps/web     │    │       apps/battle        │
                      │ (Next.js 16 App) │    │  (Socket.io Battle Node) │
                      └────────┬─────────┘    └─────────────┬────────────┘
                               │                            │
                               │ Reads/Writes               │ Battle state,
                               │ Schedules, Auth, Notes     │ ELO, Mastery
                               │                            │
                               ▼                            ▼
                      ┌──────────────────────────────────────────────────┐
                      │              PostgreSQL Database                 │
                      │  (Prisma 7: Users, Elo, Mastery, Exams, Battles) │
                      └────────────────────────▲─────────────────────────┘
                                               │
                                               │ Nightly re-plan,
                                               │ Question generation & review
                                               │
                                      ┌────────┴─────────┐
                                      │   apps/worker    │
                                      │ (BullMQ / Redis) │
                                      └──────────────────┘
```

> 🔒 **Architectural Boundary**: The battle service and the study planner never communicate directly. They interact asynchronously through PostgreSQL—battle outcomes update topic `mastery`, which the study scheduler consumes when planning future sessions.

---

## 🧩 Monorepo Workspaces

| Workspace | Type | Description |
| :--- | :--- | :--- |
| [`packages/core`](packages/core) | Library | **Pure, zero-I/O domain logic** with unit tests: ELO formulas, matchmaking bands, battle scoring & HP damage rules, derangement question permutations, exponential moving average topic mastery, sub-topic breakdown diagnostics, **deterministic study scheduler**, skip rebalancing, extraction parsing, fuzzy topic matching, streak calculations, boost effects, and socket event contracts. |
| [`packages/db`](packages/db) | Library | **Prisma 7 schema & migrations**, database client with `@prisma/adapter-pg`, seed curriculum (72 hand-checked questions), JEE Main syllabus index (`src/content/jee.ts`), planner database services, and resource verification utilities. |
| [`packages/ai`](packages/ai) | Library | **Google Gemini (`@google/genai`) client** with Zod schema validation and deterministic fallbacks: offline question generator, blind reviewer & validator, weak-spot diagnostic analyzer, conversational planner extractor, coach assistant, and AI resource finder. |
| [`apps/web`](apps/web) | Next.js 16 | **Full-stack web application**: Dashboard, live matchmaking & battle arena UI, post-battle breakdown & question review, planner chat & calendar grid, progress charts, JEE resource library, coach drawer, onboarding flow, and Auth.js authentication. |
| [`apps/battle`](apps/battle) | Node Service | **Socket.io real-time battle server**: In-memory room lifecycle, signed battle token validation, dynamic ELO matchmaking queue, turn timers, disconnect grace periods, boost resolution, and battle persistence. Scalable horizontally via Redis adapter & `BattleRegistry`. |
| [`apps/worker`](apps/worker) | Background Worker / CLI | **BullMQ queue processor & standalone CLI**: Offline multi-pass question generation and validation pipeline, resource link checker, and nightly study schedule re-optimization. |

---

## 🔐 Architectural Invariants & Core Rules

1. **Battles only serve `validated = true` questions**: Live-generated questions are never served during a battle. Questions are generated offline and must pass an automated blind review (where a separate AI reviewer solves the question and matches the stored answer key) or a manual educator spot-check.
2. **The LLM never schedules**: Gemini extracts JSON entities (subjects, topics, target dates, priorities) from freeform chat. The actual calendar distribution, session durations, and topic interleaving are computed by a deterministic pure scheduling algorithm.
3. **No silent exam creation**: Planner drafts remain in the client/chat payload until the student reviews and explicitly clicks **Confirm Exam**.
4. **Independent ELO & Mastery**: ELO tracks competitive performance per subject (used for matchmaking); Topic Mastery tracks cognitive understanding per topic (Exponential Moving Average used by the scheduler).
5. **Token-Secured User Identity**: Battle sockets authenticate via signed JWTs (`userId`), avoiding reliance on ephemeral `socket.id` connections.
6. **Graceful Disconnect Recovery**: A dropped WebSocket connection halts the server clock and gives the player a 20-second grace window to reconnect without penalty.
7. **Server-Authoritative Combat**: Timers, answer evaluations, damage calculations, and boost effects are executed exclusively on the server.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend / Full Stack** | Next.js 16 (App Router), React 19 | Server Components, Server Actions, Route Handlers |
| **Styling & UI** | Tailwind CSS, Radix UI Primitives, Lucide Icons | Industry Design System, custom glowing micro-animations |
| **Real-Time Communication** | Socket.io 4.8, WebSockets | Signed JWT tokens via `jose`, room state machine |
| **Database & ORM** | PostgreSQL 17, Prisma 7 | `@prisma/adapter-pg`, connection pooling, typed migrations |
| **Artificial Intelligence** | Google Gemini (`@google/genai`) | `gemini-3.8-flash`, structured JSON outputs, strict Zod validation |
| **Background Jobs & Queue** | BullMQ 6.3, Redis (Upstash compatible) | Scheduled question pipeline, nightly re-plans |
| **Authentication** | Auth.js (NextAuth v5 beta) | Demo instant sign-in, Google OAuth, Resend magic links |
| **Language & Tooling** | TypeScript 5.9, Turborepo 2.10, Vitest 4.1 | Monorepo task orchestration, zero-I/O unit test suite |

---

## ⚡ Quickstart & Local Setup

### Prerequisites
- **Node.js**: `v22.12.0` or higher (Node 22 & 24 supported)
- **npm**: `v10.9.0` or higher
- *No Docker required for local development* (an embedded PostgreSQL instance is downloaded and managed automatically).

### Step-by-Step Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/quizbo.git
   cd quizbo
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Embedded Local PostgreSQL**:
   ```bash
   # Starts a local PostgreSQL 17 instance on port 54329 (data saved to .local/postgres)
   npm run db:local
   ```

4. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and verify the defaults:*
   ```env
   DATABASE_URL="postgresql://quizbo:quizbo@127.0.0.1:54329/quizbo?sslmode=disable"
   AUTH_SECRET="use-a-random-secret-or-run-npx-auth-secret"
   BATTLE_JWT_SECRET="use-a-long-random-string-for-jwt-signing"
   NEXT_PUBLIC_BATTLE_URL="http://localhost:4000"
   WEB_ORIGIN="http://localhost:3000"
   AUTH_DEMO_LOGIN="true"
   GEMINI_API_KEY="" # Optional: free key from https://aistudio.google.com/apikey
   ```

5. **Initialize Local Database Schema & Seed Data**:
   ```bash
   # Apply Prisma migrations to the local database
   npm run db:deploy

   # Seed initial curriculum and demo accounts
   SEED_DEMO_DATA=true npm run db:seed
   ```

6. **Start Development Servers**:
   ```bash
   # Starts apps/web on :3000 and apps/battle on :4000
   npm run dev
   ```

7. **Launch the Application**:
   Open **http://localhost:3000** in your browser, enter any demo name (e.g. `Alex Hunter`), complete the onboarding quiz, and start exploring.

---

## 🥊 Solo Testing with Sparring Partner

To test real-time 1v1 battles locally without opening a second browser window, use the built-in sparring partner bot:

```bash
# 1. Open http://localhost:3000/play and create an invite room (note the 5-letter room code, e.g. AB3XQ)
# 2. Run the sparring partner in a separate terminal:
npm run sparring -w @quizbo/battle -- --room AB3XQ --accuracy 0.65 --boosts 0.8
```

---

## 🧪 Testing, QA & Verification

```bash
# Run unit and integration test suites across all workspaces
npm test

# Run TypeScript type checking across the entire monorepo
npm run typecheck

# Test Google Gemini API connectivity & smoke-test prompt schemas
npm run smoke -w @quizbo/ai

# Validate external JEE textbook study links for availability and content matching
npm run resources:check -w @quizbo/db
```

---

## 📜 CLI & Script Reference

### Development & Build
| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local database check, `apps/web` (port 3000), and `apps/battle` (port 4000). |
| `npm run build` | Builds all packages and applications via Turborepo. |
| `npm run typecheck` | Runs TypeScript type checking across all workspaces. |
| `npm test` | Executes unit and integration test suites (`vitest`). |

### Database & Content (`packages/db`)
| Command | Description |
| :--- | :--- |
| `npm run db:local` | Starts the embedded local PostgreSQL server on `:54329`. |
| `npm run db:stop` | Stops the embedded local PostgreSQL server. |
| `npm run db:generate` | Generates the Prisma 7 client. |
| `npm run db:migrate` | Runs Prisma development migrations (`prisma migrate dev`). |
| `npm run db:deploy` | Applies pending Prisma migrations in production / staging. |
| `npm run db:seed` | Seeds curriculum topics, initial questions, and demo players. |
| `npm run db:demo-plan` | Populates demo study plans and past study sessions for visual testing. |
| `npm run resources:check -w @quizbo/db` | Fetches and validates all curated JEE study links against target keyword assertions. |

### Question Pipeline & Worker CLI (`apps/worker`)
The worker CLI operates standalone without requiring an active Redis instance:

```bash
# Check status of question bank across topics (unvalidated, validated, rejected)
npm run questions:pipeline -- status

# Top up question bank: generate, validate, and retry until all topics reach quota
npm run questions:pipeline -- fill --min 10

# Generate new questions for a subject offline
npm run questions:pipeline -- generate --subject physics-12 --count 8

# Run blind AI validation pass on unreviewed questions
npm run questions:pipeline -- validate --limit 50

# Sample random questions for human / educator spot-check
npm run questions:pipeline -- spot-check --sample 10

# Discover external study resources for weakest topics
npm run questions:pipeline -- resources --topics 10

# Re-run deterministic scheduler for all students with upcoming exams
npm run questions:pipeline -- replan
```

---

## 🎮 Tactical Boosts Reference

Each battle round allows one tactical boost to be armed before submitting an answer:

| Boost | Effect | Server Authoritative Rule |
| :--- | :--- | :--- |
| **Bubble Shield** | Negates next incoming damage instance | Cleared upon taking damage; checked before Mirror Coat |
| **Double Tap** | Next correct answer inflicts 2× damage | Consumed on next correct answer |
| **Fifty-Fifty** | Eliminates 2 incorrect options | Eliminates options dynamically for client view |
| **Time Warp** | Grants +5 extra seconds on the round timer | Server clock extension |
| **Med Kit** | Restores +15 HP (capped at 100 HP) | Applied immediately on server |
| **Mirror Coat** | Reflects 50% of next incoming damage back to opponent | Can knock out the attacker |
| **Streak Anchor** | Prevents streak from resetting on a wrong answer | Consumed on next incorrect answer |
| **Vampire Bite** | Heals 50% of damage dealt on next correct hit | Consumed on next correct answer |
| **Ink Splat** | Blurs opponent's question interface for 3 seconds | Client-side visual disruption |
| **Overclock** | Locks speed bonus active regardless of answer time | Evaluated on next answer submission |

---

## 🚀 Deployment & Production

See **[DEPLOY.md](DEPLOY.md)** for exhaustive deployment runbooks, architecture guidelines, and production checklists.

### Deployment Options

1. **Option A: Recommended Managed Split (Production)**:
   - **Database**: Neon (Serverless Postgres) or Supabase.
   - **Web Application**: Vercel (Next.js 16 with `vercel.json`).
   - **Battle Service**: Fly.io (`deploy/fly.battle.toml`) or Render (long-lived WebSocket node).
   - **Worker & Caching**: Upstash Redis + background worker.
2. **Option B: One-Click Render Blueprint**:
   - `render.yaml` provisions PostgreSQL, Web Service, and Battle Service with automated environment variable pairing.
3. **Option C: Self-Hosted Docker Compose**:
   - Run `docker compose up --build` with the multi-stage [Dockerfile](Dockerfile).

---

## 📈 Horizontal Battle Clustering

To scale the battle service across multiple container instances, set `BATTLE_REDIS_URL`:
- **Room Ownership**: Each room lives on the instance that created it; players can connect to any instance and have events routed seamlessly via the Socket.io Redis adapter.
- **Shared Queue & Lease**: Matchmaking queues and active room registries are coordinated in Redis. One instance at a time holds the matchmaker lease.
- **Self-Healing**: Registry entries expire 90s after an instance stops heartbeating, preventing orphaned sessions.

---

## 📚 Project Documentation & References

- **[OBSERVATIONS.md](OBSERVATIONS.md)** — Comprehensive live deployment QA test report on `https://quizbo-web.onrender.com/`.
- **[DEPLOY.md](DEPLOY.md)** — Production deployment runbook, scaling architecture, and launch checklists.
- **[ASSUMPTIONS.md](ASSUMPTIONS.md)** — Design decisions, database schema additions, scoring algorithms, and game rules.

