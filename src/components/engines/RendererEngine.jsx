import { labelGoal } from "@/lib/utils";

export const RendererEngine = {
  createBadges(plan) {
    return [
      { label: "Obiectiv", value: labelGoal(plan.goal) },
      { label: "Tinta", value: `${plan.targets.kcal} kcal` },
      { label: "Profil", value: `${plan.profileSnapshot.sex === "male" ? "Barbat" : "Femeie"}, ${plan.profileSnapshot.age} ani` },
    ];
  },

  createSummary(profile, targets) {
    return `Plan personalizat pentru ${labelGoal(profile.goal)} la ${targets.kcal} kcal/zi. Accent pe ${targets.protein}g proteine, ${targets.carbs}g carbohidrati, ${targets.fat}g grasimi si ${targets.fibre}g fibre.`;
  },
};

export default RendererEngine;
