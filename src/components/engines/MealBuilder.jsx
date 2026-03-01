import { getFoodById } from "@/components/data/FoodDB";

const MEAL_BLUEPRINT = [
  { name: "Mic Dejun", ratio: 0.28, foods: ["oats", "eggs", "banana"] },
  { name: "Pranz", ratio: 0.34, foods: ["chicken", "rice", "veggies", "olive"] },
  { name: "Gustare", ratio: 0.14, foods: ["yogurt", "nuts"] },
  { name: "Cina", ratio: 0.24, foods: ["salmon", "potato", "veggies"] },
];

export const MealBuilder = {
  buildMeals(targets) {
    return MEAL_BLUEPRINT.map((slot) => ({
      name: slot.name,
      kcal: Math.round(targets.kcal * slot.ratio),
      macros: {
        protein: Math.round(targets.protein * slot.ratio),
        carbs: Math.round(targets.carbs * slot.ratio),
        fat: Math.round(targets.fat * slot.ratio),
        fibre: Math.round(targets.fibre * slot.ratio),
      },
      ingredients: slot.foods
        .map((foodId) => getFoodById(foodId))
        .filter(Boolean)
        .map((food) => ({
          id: food.id,
          name: food.name,
          amount: food.unit,
        })),
    }));
  },
};

export default MealBuilder;
