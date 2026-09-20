import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// Locally every app reads the repo-root .env; on a host the platform's variables win (loadEnvFile
// never overrides a variable that is already set).
try {
  process.loadEnvFile(path.join(repoRoot, ".env"));
} catch {
  // No .env file — rely on the real environment.
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for the battle service`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? process.env.BATTLE_PORT ?? 4000),
  jwtSecret: required("BATTLE_JWT_SECRET"),
  corsOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** Set to run several battle instances: they share rooms and the queue through this Redis. */
  redisUrl: process.env.BATTLE_REDIS_URL?.trim() || null,
};
