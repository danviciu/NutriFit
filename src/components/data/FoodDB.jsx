export const FOOD_DB = [
  { id: "oats", name: "Fulgi de ovaz", unit: "60 g", kcal: 228, protein: 8, carbs: 39, fat: 4, fibre: 6 },
  { id: "eggs", name: "Oua", unit: "2 buc", kcal: 140, protein: 12, carbs: 1, fat: 10, fibre: 0 },
  { id: "chicken", name: "Piept de pui", unit: "150 g", kcal: 248, protein: 45, carbs: 0, fat: 5, fibre: 0 },
  { id: "rice", name: "Orez gatit", unit: "180 g", kcal: 234, protein: 4, carbs: 52, fat: 1, fibre: 1 },
  { id: "salmon", name: "Somon", unit: "150 g", kcal: 285, protein: 31, carbs: 0, fat: 17, fibre: 0 },
  { id: "potato", name: "Cartofi copti", unit: "250 g", kcal: 215, protein: 5, carbs: 48, fat: 0, fibre: 5 },
  { id: "yogurt", name: "Iaurt grecesc", unit: "200 g", kcal: 146, protein: 20, carbs: 7, fat: 4, fibre: 0 },
  { id: "banana", name: "Banana", unit: "1 buc", kcal: 105, protein: 1, carbs: 27, fat: 0, fibre: 3 },
  { id: "veggies", name: "Legume mix", unit: "220 g", kcal: 88, protein: 4, carbs: 16, fat: 1, fibre: 6 },
  { id: "olive", name: "Ulei de masline", unit: "10 g", kcal: 90, protein: 0, carbs: 0, fat: 10, fibre: 0 },
  { id: "cottage", name: "Branza cottage", unit: "180 g", kcal: 150, protein: 24, carbs: 8, fat: 3, fibre: 0 },
  { id: "nuts", name: "Nuci mix", unit: "30 g", kcal: 185, protein: 5, carbs: 6, fat: 16, fibre: 3 },
];

export function getFoodById(id) {
  return FOOD_DB.find((item) => item.id === id);
}

export default FOOD_DB;
