"use server";

import { prisma } from "@quizbo/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SUBJECT_COOKIE } from "@/lib/data/subjects";
import { getViewer } from "@/lib/session";

export async function selectSubject(subjectId: string) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Sign in first.");
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) return;
  (await cookies()).set(SUBJECT_COOKIE, subject.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
