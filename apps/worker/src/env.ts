import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

try {
  process.loadEnvFile(path.join(repoRoot, ".env"));
} catch {
  // No .env file — rely on the real environment.
}
