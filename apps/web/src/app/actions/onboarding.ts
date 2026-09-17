"use server";

import { isValidTimeZone, placementRating } from "@quizbo/core";
import { prisma } from "@quizbo/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/session";

const OnboardingSchema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you.").max(40),
  examGoal: z.enum(["BOARD", "ENTRANCE", "SCHOOL", "KEEPING_UP"], { message: "Pick what you're studying for." }),
  confidence: z.coerce.number().int().min(1).max(5, "Pick how confident you feel."),
  motivationStyle: z.enum(["COMPETITIVE", "PROGRESS", "REMINDER"], { message: "Pick what keeps you going." }),
  dailyStudyMinutes: z.coerce.number().int().min(15).max(300),
  timezone: z.string().max(64).optional(),
});

/**
 * Onboarding (features.md §2.1): sets the placement ELO band for every subject, the coach's tone
 * (via motivation style) and which surface the home screen emphasises.
 */
export async function completeOnboarding(_previous: string | null, formData: FormData): Promise<string | null> {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");

  const parsed = OnboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check your answers.";
  const answers = parsed.data;
  const timezone = answers.timezone && isValidTimeZone(answers.timezone) ? answers.timezone : "UTC";

  const subjects = await prisma.subject.findMany({ select: { id: true } });
  const rating = placementRating(answers.confidence);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: viewer.id },
      data: {
        name: answers.name,
        examGoal: answers.examGoal,
        confidence: answers.confidence,
        motivationStyle: answers.motivationStyle,
        dailyStudyMinutes: answers.dailyStudyMinutes,
        timezone,
        onboardedAt: new Date(),
      },
    }),
    ...subjects.map((subject) =>
      prisma.eloRating.upsert({
        where: { userId_subjectId: { userId: viewer.id, subjectId: subject.id } },
        update: {},
        create: { userId: viewer.id, subjectId: subject.id, rating, matchesPlayed: 0 },
      }),
    ),
  ]);

  redirect("/dashboard");
}
