"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInWithEmail(_previous: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  try {
    await signIn("resend", { email, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return "Couldn't send the sign-in link. Try again.";
    throw error;
  }
  return null;
}

export async function signInDemo(_previous: string | null, formData: FormData): Promise<string | null> {
  try {
    await signIn("demo", {
      name: String(formData.get("name") ?? ""),
      key: String(formData.get("key") ?? ""),
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    // Only a rejected name is the user's to fix; anything else (usually the database) is ours.
    if (error.type === "CredentialsSignin") return "Use a name with at least 2 characters.";
    console.error("[auth] demo sign-in failed", error.cause ?? error);
    return "Couldn't sign you in: the server can't reach its database. Try again in a moment.";
  }
  return null;
}

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
