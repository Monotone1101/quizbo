// Starts the local Prisma Postgres dev server — or says so if it's already running.
// `prisma dev` exits with "port already in use" when the instance is up, which looks like a failure.
//
//   node scripts/local-db.mjs            foreground (Ctrl+C stops it)
//   node scripts/local-db.mjs --ensure   start it in the background if it's down (used by `npm run dev`);
//                                        does nothing when DATABASE_URL points somewhere else
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const DB_PORT = 51214;
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env"), quiet: true });

const ensure = process.argv.includes("--ensure");
const passthrough = process.argv.slice(2).filter((arg) => arg !== "--ensure");

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

function run(args) {
  return new Promise((resolve) => {
    const child = spawn("prisma", ["dev", "--name", "quizbo", ...args], { cwd: path.resolve(here, ".."), stdio: "inherit", shell: true });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

if (ensure && !new RegExp(`@(localhost|127\\.0\\.0\\.1):${DB_PORT}/`).test(process.env.DATABASE_URL ?? "")) {
  process.exit(0);
}

if (await isListening(DB_PORT)) {
  if (!ensure) {
    console.info(`Local Postgres is already running on port ${DB_PORT} — nothing to do.`);
    console.info(`DATABASE_URL="postgres://postgres:postgres@localhost:${DB_PORT}/template1?sslmode=disable"`);
    console.info("Stop it with: npx prisma dev stop quizbo   (run inside packages/db)");
  }
  process.exit(0);
}

if (!ensure) process.exit(await run(passthrough));

console.info(`Local Postgres is not running — starting it in the background on port ${DB_PORT}…`);
const code = await run(["--detach"]);
for (let i = 0; i < 40 && !(await isListening(DB_PORT)); i++) await new Promise((r) => setTimeout(r, 250));
if (!(await isListening(DB_PORT))) {
  console.error(`Could not start the local database (prisma dev exited with ${code}). Run \`npm run db:local\` to see why.`);
  process.exit(1);
}
console.info("Local Postgres is up.");
