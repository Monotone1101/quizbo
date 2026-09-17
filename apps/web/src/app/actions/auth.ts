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
    if (error instanceof AuthError) return "Use a name with at least 2 characters.";
    throw error;
  }
  return null;
}

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
