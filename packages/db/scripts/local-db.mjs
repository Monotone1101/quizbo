// Local PostgreSQL for development: a real Postgres server run from npm (embedded-postgres), so the
// web app, battle service and worker can all use it at once. No Docker or installer needed.
//
//   node scripts/local-db.mjs            start it (if needed) and print the connection string
//   node scripts/local-db.mjs --ensure   same, quietly, then apply pending migrations and seed a fresh
//                                        database — run by `npm run dev`. Does nothing when
//                                        DATABASE_URL points at another database.
//   node scripts/local-db.mjs --stop     stop it
//
// Data lives in <repo>/.local/postgres (git-ignored) and survives restarts.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pg from "pg";

export const LOCAL_PORT = 54329;
const DATABASES = ["quizbo", "quizbo_shadow"];

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const dataDir = path.join(repoRoot, ".local", "postgres");
const logFile = path.join(repoRoot, ".local", "postgres.log");
loadEnv({ path: path.join(repoRoot, ".env"), quiet: true });

const ensure = process.argv.includes("--ensure");
const stop = process.argv.includes("--stop");
const localUrl = (db) => `postgres://postgres:postgres@localhost:${LOCAL_PORT}/${db}`;

function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function binaries() {
  const pkg = `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
  try {
    return await import(pkg);
  } catch {
    throw new Error(`PostgreSQL binaries for this machine (${pkg}) aren't installed. Run \`npm install\`.`);
  }
}

function run(bin, args, label) {
  const result = spawnSync(bin, args, { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`${label} failed:\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  return result;
}

async function start() {
  const { initdb, pg_ctl } = await binaries();
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    mkdirSync(dataDir, { recursive: true });
    console.info(`Creating the local database in ${path.relative(repoRoot, dataDir)}…`);
    run(initdb, ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C"], "initdb");
  }
  if (await isListening(LOCAL_PORT)) return false;
  // pg_ctl runs the server in the background; it keeps running after this script exits.
  run(pg_ctl, ["-D", dataDir, "-l", logFile, "-o", `-p ${LOCAL_PORT} -c listen_addresses=localhost`, "-w", "-t", "60", "start"], "pg_ctl start");
  return true;
}

async function createDatabases() {
  const admin = new pg.Client({ connectionString: localUrl("postgres") });
  await admin.connect();
  try {
    for (const name of DATABASES) {
      const found = await admin.query("select 1 from pg_database where datname = $1", [name]);
      if (!found.rowCount) await admin.query(`create database ${name}`);
    }
  } finally {
    await admin.end();
  }
}

/** Applies pending migrations; when that created the tables, loads the seed data. */
function heal() {
  const cwd = path.resolve(here, "..");
  const deploy = spawnSync("npx prisma migrate deploy", { cwd, shell: true, encoding: "utf8" });
  if (deploy.status !== 0) {
    console.error(`Could not apply migrations to the local database:\n${deploy.stdout}${deploy.stderr}`);
    return deploy.status ?? 1;
  }
  if (/No pending migrations/i.test(deploy.stdout)) return 0;
  console.info("Local database was empty: migrations applied, loading seed data…");
  const seed = spawnSync("npx tsx prisma/seed.ts", {
    cwd,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, SEED_DEMO_DATA: process.env.SEED_DEMO_DATA ?? "true" },
  });
  return seed.status ?? 0;
}

if (stop) {
  const { pg_ctl } = await binaries();
  if (!(await isListening(LOCAL_PORT))) {
    console.info("The local database isn't running.");
    process.exit(0);
  }
  run(pg_ctl, ["-D", dataDir, "-m", "fast", "-w", "stop"], "pg_ctl stop");
  console.info("Local database stopped.");
  process.exit(0);
}

if (ensure && !new RegExp(`@(localhost|127\\.0\\.0\\.1):${LOCAL_PORT}/`).test(process.env.DATABASE_URL ?? "")) {
  process.exit(0);
}

try {
  const started = await start();
  await createDatabases();
  if (!ensure) {
    console.info(started ? `Local PostgreSQL started on port ${LOCAL_PORT}.` : `Local PostgreSQL is already running on port ${LOCAL_PORT}.`);
    console.info(`DATABASE_URL="${localUrl("quizbo")}"`);
    console.info(`SHADOW_DATABASE_URL="${localUrl("quizbo_shadow")}"`);
    console.info("Stop it with: npm run db:stop");
    process.exit(0);
  }
  if (started) console.info(`Local PostgreSQL started on port ${LOCAL_PORT}.`);
  process.exit(heal());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(`See ${path.relative(repoRoot, logFile)} for the server log.`);
  process.exit(1);
}
