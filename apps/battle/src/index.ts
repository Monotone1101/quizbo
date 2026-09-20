import { config } from "./env";
import { hostname } from "node:os";
import { createServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { createTokenVerifier } from "./auth";
import { dbDeps } from "./deps";
import { RedisRegistry } from "./registry";
import { createBattleServer } from "./server";

// Several instances share rooms and the queue through Redis (BATTLE_REDIS_URL); otherwise one instance
// keeps everything in memory. See "Running several instances" in server.ts.
const redis = config.redisUrl ? new Redis(config.redisUrl, { maxRetriesPerRequest: 3 }) : null;
const subscriber = redis?.duplicate() ?? null;
const instanceId = `${hostname()}-${process.pid}`;

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "quizbo-battle", ...battle.stats() }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});

const battle = createBattleServer(httpServer, {
  ...dbDeps,
  verifyToken: createTokenVerifier(config.jwtSecret),
  corsOrigins: config.corsOrigins,
  ...(redis && subscriber
    ? { adapter: createAdapter(redis, subscriber), registry: new RedisRegistry(redis), instanceId }
    : {}),
});

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `[battle] port ${config.port} is already in use — an earlier battle server is probably still running. ` +
        `Close the old \`npm run dev\` (or end that node process) and start again.`,
    );
    process.exit(1);
  }
  throw error;
});

httpServer.listen(config.port, () => {
  console.info(
    `[battle] listening on :${config.port} (origins: ${config.corsOrigins.join(", ")})` +
      (redis ? ` · cluster mode as ${instanceId}` : " · single instance"),
  );
});

const shutdown = async (signal: string) => {
  console.info(`[battle] ${signal} received, closing`);
  await battle.close();
  await Promise.all([redis?.quit(), subscriber?.quit()]).catch(() => {});
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
