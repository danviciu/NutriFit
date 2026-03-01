import { generatePlanWithApi } from "@/api/ai";
import { NutritionPlan } from "../../../entities/NutritionPlan";
import { FitnessBuilder } from "@/components/engines/FitnessBuilder";
import { LabEngine } from "@/components/engines/LabEngine";
import { MealBuilder } from "@/components/engines/MealBuilder";
import { PlanValidator } from "@/components/engines/PlanValidator";
import { ProfileEngine } from "@/components/engines/ProfileEngine";
import { RendererEngine } from "@/components/engines/RendererEngine";
import { TargetCalculator } from "@/components/engines/TargetCalculator";

function aggregateShoppingList(meals) {
  const map = new Map();

  meals.forEach((meal) => {
    meal.ingredients.forEach((item) => {
      const existing = map.get(item.name);
      if (existing) {
        map.set(item.name, { ...existing, count: existing.count + 1 });
      } else {
        map.set(item.name, { amount: item.amount, count: 1 });
      }
    });
  });

  return Array.from(map.entries()).map(([name, value]) => ({
    name,
    amount: `${value.count}x (${value.amount})`,
  }));
}

function normalizeApiPlan(apiResult, profile) {
  const raw = apiResult?.plan || apiResult;
  if (!raw || typeof raw !== "object") return null;

  const plan = new NutritionPlan({
    createdAt: raw.createdAt || new Date().toISOString(),
    goal: raw.goal || profile.goal,
    targets: raw.targets,
    meals: Array.isArray(raw.meals) ? raw.meals : [],
    shoppingList: Array.isArray(raw.shoppingList) ? raw.shoppingList : [],
    fitness: Array.isArray(raw.fitness) ? raw.fitness : [],
    labs: raw.labs || { status: "auto", notes: "Analize neincarcate." },
    summary: raw.summary || "",
    profileSnapshot: raw.profileSnapshot || profile,
  });

  if (plan.shoppingList.length === 0 && plan.meals.length > 0) {
    plan.shoppingList = aggregateShoppingList(plan.meals);
  }

  if (!plan.fitness.length) {
    plan.fitness = FitnessBuilder.build(profile.goal);
  }

  if (!plan.summary) {
    plan.summary = RendererEngine.createSummary(profile, plan.targets || {});
  }

  plan.badges = RendererEngine.createBadges(plan);

  const validation = PlanValidator.validate(plan);
  return validation.isValid ? plan : null;
}

function buildLocalPlan(profile) {
  const targets = TargetCalculator.calculate(profile);
  const meals = MealBuilder.buildMeals(targets, profile);

  const plan = new NutritionPlan({
    createdAt: new Date().toISOString(),
    goal: profile.goal,
    targets,
    meals,
    shoppingList: aggregateShoppingList(meals),
    fitness: FitnessBuilder.build(profile.goal),
    labs: LabEngine.build(profile),
    summary: RendererEngine.createSummary(profile, targets),
    profileSnapshot: profile,
  });

  plan.badges = RendererEngine.createBadges(plan);

  const validation = PlanValidator.validate(plan);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  return plan;
}

export const PlanEngine = {
  async generate(profileInput) {
    const profile = ProfileEngine.normalize(profileInput);

    const apiResult = await generatePlanWithApi(profile);
    const apiPlan = normalizeApiPlan(apiResult, profile);
    if (apiPlan) return apiPlan;

    return buildLocalPlan(profile);
  },
};

export default PlanEngine;
