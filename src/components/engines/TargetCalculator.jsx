const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const GOAL_DEFAULT_DELTA = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

const PROTEIN_FACTOR = {
  lose: 1.8,
  maintain: 1.6,
  gain: 2.0,
};

export const TargetCalculator = {
  calculate(profile) {
    const bmr =
      profile.sex === "male"
        ? 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5
        : 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161;

    const tdee = bmr * (ACTIVITY_FACTORS[profile.activityLevel] || ACTIVITY_FACTORS.moderate);

    const hasManualDelta = Number.isFinite(profile.goalDeltaKcal) && profile.goalDeltaKcal !== 0;
    const goalDelta = hasManualDelta ? profile.goalDeltaKcal : GOAL_DEFAULT_DELTA[profile.goal] || 0;

    const kcal = Math.max(1200, Math.round(tdee + goalDelta));
    const protein = Math.round(profile.weightKg * (PROTEIN_FACTOR[profile.goal] || PROTEIN_FACTOR.maintain));
    const fat = Math.round(profile.weightKg * 0.8);

    const caloriesLeft = kcal - protein * 4 - fat * 9;
    const carbs = Math.max(60, Math.round(caloriesLeft / 4));
    const fibre = Math.max(18, Math.round((kcal / 1000) * 14));

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      goalDelta,
      kcal,
      protein,
      carbs,
      fat,
      fibre,
    };
  },
};

export default TargetCalculator;
