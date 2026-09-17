import { BATTLE_TOKEN } from "@quizbo/core";
import { jwtVerify } from "jose";
import type { AuthUser } from "./server";

/**
 * Verifies the battle token minted by the web app (/api/battle/token). The token's `sub` is the
 * stable Auth.js user id, which is what every piece of room state is keyed by.
 */
export function createTokenVerifier(secret: string) {
  const key = new TextEncoder().encode(secret);
  return async (token: string): Promise<AuthUser | null> => {
    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: BATTLE_TOKEN.issuer,
        audience: BATTLE_TOKEN.audience,
        algorithms: ["HS256"],
      });
      if (typeof payload.sub !== "string" || !payload.sub) return null;
      const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "Player";
      return { id: payload.sub, name };
    } catch {
      return null;
    }
  };
}
