import { ValidatorEngine } from "@/components/engines/ValidatorEngine";

export const PlanValidator = {
  validate(plan) {
    const errors = [];

    if (!plan || typeof plan !== "object") {
      errors.push("Plan invalid");
    }

    if (!ValidatorEngine.hasTargets(plan)) {
      errors.push("Targets lipsa sau invalide");
    }

    if (!ValidatorEngine.hasMeals(plan)) {
      errors.push("Mese lipsa");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

export default PlanValidator;
