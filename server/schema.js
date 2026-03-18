import { z } from "zod";

export const profileSchema = z.object({
  sex: z.enum(["male", "female"]).default("female"),
  age: z.coerce.number().min(8, "Vârsta minimă este de 8 ani").max(120, "Vârsta maximă este de 120 ani"),
  heightCm: z.coerce.number().min(50, "Înălțimea minimă este de 50 cm").max(300, "Înălțimea maximă este de 300 cm"),
  weightKg: z.coerce.number().min(20, "Greutatea minimă este de 20 kg").max(400, "Greutatea maximă este de 400 kg"),
  goal: z.enum(["lose", "maintain", "gain"]).default("maintain"),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).default("moderate"),
  dietaryPrefs: z.string().max(500).optional().default(""),
  allergies: z.string().max(500).optional().default(""),
  lifestyle: z.string().max(1000).optional().default(""),
  labsText: z.string().optional().default(""),
  labsFileName: z.string().optional().default("")
});

export const userEventSchema = z.object({
  eventName: z.string().min(1).max(80),
  page: z.string().max(300).optional().default(""),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  occurredAt: z.string().datetime().optional(),
});

export const dailyCheckinSchema = z.object({
  checkinDate: z.string().date().optional(),
  weightKg: z.coerce.number().min(20).max(400).optional(),
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  energyLevel: z.coerce.number().int().min(1).max(5).optional(),
  hungerLevel: z.coerce.number().int().min(1).max(5).optional(),
  workoutDone: z.boolean().optional(),
  notes: z.string().max(1200).optional(),
});

export const notificationPreferencesSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  timezone: z.string().min(3).max(64).optional(),
  quietHoursStart: z.coerce.number().int().min(0).max(23).optional(),
  quietHoursEnd: z.coerce.number().int().min(0).max(23).optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  weeklyDigestDay: z.coerce.number().int().min(0).max(6).optional(),
  weeklyDigestHour: z.coerce.number().int().min(0).max(23).optional(),
});

export const subscriptionChangeSchema = z.object({
  planCode: z.enum(["pro_monthly"]).optional().default("pro_monthly"),
});
