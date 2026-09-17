import { config } from "./env";
import { createServer } from "node:http";
import { createTokenVerifier } from "./auth";
import { dbDeps } from "./deps";
import { createBattleServer } from "./server";

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
});

httpServer.listen(config.port, () => {
  console.info(`[battle] listening on :${config.port} (origins: ${config.corsOrigins.join(", ")})`);
});

const shutdown = async (signal: string) => {
  console.info(`[battle] ${signal} received, closing`);
  await battle.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
