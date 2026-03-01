export const ValidatorEngine = {
  hasTargets(plan) {
    return (
      typeof plan?.targets?.kcal === "number" &&
      typeof plan?.targets?.protein === "number" &&
      typeof plan?.targets?.carbs === "number" &&
      typeof plan?.targets?.fat === "number" &&
      typeof plan?.targets?.fibre === "number"
    );
  },

  hasMeals(plan) {
    return Array.isArray(plan?.meals) && plan.meals.length > 0;
  },
};

export default ValidatorEngine;
