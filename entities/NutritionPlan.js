export class NutritionPlan {
  constructor(data = {}) {
    this.createdAt = data.createdAt || new Date().toISOString();
    this.goal = data.goal || "maintain";
    this.targets = data.targets || {
      bmr: 0,
      tdee: 0,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fibre: 0,
    };
    this.meals = data.meals || [];
    this.shoppingList = data.shoppingList || [];
    this.fitness = data.fitness || [];
    this.labs = data.labs || { status: "not_provided", notes: "Analize neincarcate." };
    this.summary = data.summary || "";
    this.badges = data.badges || [];
    this.profileSnapshot = data.profileSnapshot || {};
  }
}

