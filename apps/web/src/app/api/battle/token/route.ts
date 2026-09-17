import { BATTLE_TOKEN } from "@quizbo/core";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";

/**
 * Mints the short-lived token the browser presents to the battle service. `sub` is the stable
 * Auth.js user id, which the battle service uses to key all room state.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to battle." }, { status: 401 });
  if (!viewer.onboardedAt) return NextResponse.json({ error: "Finish onboarding first." }, { status: 403 });

  const secret = process.env.BATTLE_JWT_SECRET;
  const url = process.env.NEXT_PUBLIC_BATTLE_URL;
  if (!secret || !url) return NextResponse.json({ error: "The battle service is not configured." }, { status: 503 });

  const token = await new SignJWT({ name: viewer.name ?? "Player" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(viewer.id)
    .setIssuer(BATTLE_TOKEN.issuer)
    .setAudience(BATTLE_TOKEN.audience)
    .setIssuedAt()
    .setExpirationTime(`${BATTLE_TOKEN.ttlSeconds}s`)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token, url }, { headers: { "cache-control": "no-store" } });
}
