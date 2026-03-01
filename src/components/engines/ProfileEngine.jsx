export const ProfileEngine = {
  normalize(raw = {}) {
    const goal = ["lose", "maintain", "gain"].includes(raw.goal) ? raw.goal : "maintain";

    return {
      email: String(raw.email || "local@nutrifit.ai").trim().toLowerCase(),
      sex: raw.sex === "male" ? "male" : "female",
      age: Math.max(16, Number(raw.age) || 30),
      heightCm: Math.max(130, Number(raw.heightCm) || 170),
      weightKg: Math.max(35, Number(raw.weightKg) || 70),
      goal,
      goalDeltaKcal: Number(raw.goalDeltaKcal || 0),
      activityLevel: ["sedentary", "light", "moderate", "active"].includes(raw.activityLevel)
        ? raw.activityLevel
        : "moderate",
      dietaryPrefs: String(raw.dietaryPrefs || "").trim(),
      allergies: String(raw.allergies || "").trim(),
      labsText: String(raw.labsText || "").trim(),
      labsFileName: String(raw.labsFileName || "").trim(),
    };
  },
};

export default ProfileEngine;
