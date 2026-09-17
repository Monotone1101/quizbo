"use server";

import { isValidTimeZone, todayInTimeZone } from "@quizbo/core";
import { prisma, replanUser } from "@quizbo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/session";

const SettingsSchema = z.object({
  name: z.string().trim().min(2, "Names need at least 2 characters.").max(40),
  dailyStudyMinutes: z.coerce.number().int().min(15, "At least 15 minutes a day.").max(300, "At most 300 minutes a day."),
  motivationStyle: z.enum(["COMPETITIVE", "PROGRESS", "REMINDER"]),
  timezone: z.string().trim().refine(isValidTimeZone, "That time zone isn't recognised."),
});

export async function updateSettings(_previous: { ok: boolean; message: string } | null, formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Sign in first." };
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  const values = parsed.data;
  await prisma.user.update({ where: { id: viewer.id }, data: values });

  let message = "Saved.";
  if (values.dailyStudyMinutes !== viewer.dailyStudyMinutes || values.timezone !== viewer.timezone) {
    const plan = await replanUser(viewer.id, todayInTimeZone(values.timezone));
    if (plan.examsPlanned > 0) message = `Saved. Your plan was re-laid out for ${values.dailyStudyMinutes} minutes a day.`;
  }
  revalidatePath("/", "layout");
  return { ok: true, message };
}
