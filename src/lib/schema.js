import { z } from "zod";

export const profileSchema = z.object({
    sex: z.enum(["male", "female"]).default("female"),
    age: z.coerce.number({ invalid_type_error: "Varsta invalida" }).min(8, "Vârsta minimă 8 ani").max(120, "Vârsta maximă 120 ani"),
    heightCm: z.coerce.number({ invalid_type_error: "Inaltime invalida" }).min(50, "Minim 50 cm").max(300, "Maxim 300 cm"),
    weightKg: z.coerce.number({ invalid_type_error: "Greutate invalida" }).min(20, "Minim 20 kg").max(400, "Maxim 400 kg"),
    goal: z.enum(["lose", "maintain", "gain"]).default("maintain"),
    activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).default("moderate"),
    goalDeltaKcal: z.coerce.number().default(0),
    dietaryPrefs: z.string().max(500, "Maxim 500 de caractere").optional().default(""),
    allergies: z.string().max(500, "Maxim 500 de caractere").optional().default(""),
    lifestyle: z.string().max(1000, "Maxim 1000 de caractere").optional().default(""),
    labsText: z.string().optional().default(""),
    labsFileName: z.string().optional().default("")
});
