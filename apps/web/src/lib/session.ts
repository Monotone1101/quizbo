import "server-only";
import { todayInTimeZone } from "@quizbo/core";
import { prisma, type User } from "@quizbo/db";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";

/** The signed-in user's row, or null. A session whose user no longer exists counts as signed out. */
export const getViewer = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
});

export async function requireViewer(options: { onboarded?: boolean } = {}): Promise<User> {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");
  if ((options.onboarded ?? true) && !viewer.onboardedAt) redirect("/onboarding");
  return viewer;
}

export function viewerToday(viewer: Pick<User, "timezone">) {
  return todayInTimeZone(viewer.timezone);
}
