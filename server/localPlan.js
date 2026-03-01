const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const GOAL_DELTA = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

const PROTEIN_PER_KG = {
  lose: 1.8,
  maintain: 1.6,
  gain: 2.0,
};

const dayNames = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

const mealTemplates = [
  {
    breakfast: ["Iaurt grecesc 250g", "Ovaz 60g", "Fructe de padure 100g"],
    lunch: ["Piept de pui 180g", "Orez basmati 180g", "Salata verde"],
    snack: ["Nuci 30g", "Un mar"],
    dinner: ["Somon 170g", "Cartofi copti 250g", "Legume aburite"],
  },
  {
    breakfast: ["Omleta 3 oua", "Paine integrala 2 felii", "Avocado 1/2"],
    lunch: ["Curcan 180g", "Quinoa 160g", "Legume mix"],
    snack: ["Branza cottage 200g", "Banana"],
    dinner: ["Cod 180g", "Cartof dulce 220g", "Broccoli"],
  },
  {
    breakfast: ["Skyr 250g", "Granola 50g", "Kiwi 1 buc"],
    lunch: ["Vita slaba 170g", "Cuscus 160g", "Spanac sotat"],
    snack: ["Iaurt 2% 180g", "Migdale 25g"],
    dinner: ["Paste integrale 160g", "Ton 140g", "Sos rosii"],
  },
];

function normalizeProfile(profile) {
  return {
    sex: profile?.sex === "male" ? "male" : "female",
    age: Math.max(16, Number(profile?.age || 30)),
    heightCm: Math.max(130, Number(profile?.height_cm ?? profile?.heightCm ?? 170)),
    weightKg: Math.max(35, Number(profile?.weight_kg ?? profile?.weightKg ?? 70)),
    goal: ["lose", "maintain", "gain"].includes(profile?.goal) ? profile.goal : "maintain",
    activityLevel: ["sedentary", "light", "moderate", "active"].includes(profile?.activity_level ?? profile?.activityLevel)
      ? profile.activity_level ?? profile.activityLevel
      : "moderate",
    dietaryPrefs: String(profile?.dietary_prefs ?? profile?.dietaryPrefs ?? ""),
    allergies: String(profile?.allergies ?? ""),
    lifestyle: String(profile?.lifestyle ?? ""),
  };
}

function calculateTargets(profile) {
  const bmr =
    profile.sex === "male"
      ? 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5
      : 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161;

  const tdee = bmr * (ACTIVITY_FACTORS[profile.activityLevel] || ACTIVITY_FACTORS.moderate);
  const kcal = Math.max(1200, Math.round(tdee + (GOAL_DELTA[profile.goal] || 0)));

  const protein = Math.round(profile.weightKg * (PROTEIN_PER_KG[profile.goal] || PROTEIN_PER_KG.maintain));
  const fats = Math.round(profile.weightKg * 0.8);
  const carbs = Math.max(60, Math.round((kcal - protein * 4 - fats * 9) / 4));
  const fibre = Math.max(18, Math.round((kcal / 1000) * 14));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal,
    protein,
    carbs,
    fat: fats,
    fibre,
  };
}

function buildWeekPlan(targets) {
  return dayNames.map((day, index) => {
    const template = mealTemplates[index % mealTemplates.length];

    return {
      day,
      meals: [
        {
          slot: "Mic dejun",
          foods: template.breakfast,
          macros: {
            protein: Math.round(targets.protein * 0.25),
            carbs: Math.round(targets.carbs * 0.3),
            fat: Math.round(targets.fat * 0.25),
          },
        },
        {
          slot: "Pranz",
          foods: template.lunch,
          macros: {
            protein: Math.round(targets.protein * 0.35),
            carbs: Math.round(targets.carbs * 0.35),
            fat: Math.round(targets.fat * 0.3),
          },
        },
        {
          slot: "Gustare",
          foods: template.snack,
          macros: {
            protein: Math.round(targets.protein * 0.15),
            carbs: Math.round(targets.carbs * 0.15),
            fat: Math.round(targets.fat * 0.15),
          },
        },
        {
          slot: "Cina",
          foods: template.dinner,
          macros: {
            protein: Math.round(targets.protein * 0.25),
            carbs: Math.round(targets.carbs * 0.2),
            fat: Math.round(targets.fat * 0.3),
          },
        },
      ],
    };
  });
}

function buildShoppingList(weeklyPlan) {
  const map = new Map();

  weeklyPlan.forEach((day) => {
    day.meals.forEach((meal) => {
      meal.foods.forEach((food) => {
        map.set(food, (map.get(food) || 0) + 1);
      });
    });
  });

  return Array.from(map.entries()).map(([item, count]) => ({
    item,
    quantity: `${count} portii/saptamana`,
  }));
}

function fitnessRecommendations(goal) {
  const base = [
    "3 antrenamente full-body/saptamana",
    "Minimum 7.000 pasi zilnic",
    "10 minute mobilitate dupa antrenament",
  ];

  if (goal === "lose") {
    return [...base, "2 sesiuni cardio zona 2 (25-35 min)"];
  }

  if (goal === "gain") {
    return [...base, "Creste progresiv incarcarea in sala (+2.5kg cand poti)"];
  }

  return [...base, "Pastreaza volum moderat si monitorizeaza recuperarea"];
}

export function generateLocalPlan(rawProfile, labsExtracted) {
  const profile = normalizeProfile(rawProfile);
  const targets = calculateTargets(profile);
  const weeklyPlan = buildWeekPlan(targets);
  const shoppingList = buildShoppingList(weeklyPlan);

  const warnings = Array.isArray(labsExtracted?.warnings) ? labsExtracted.warnings : [];

  return {
    createdAt: new Date().toISOString(),
    targets,
    profile,
    weeklyPlan,
    shoppingList,
    fitness: fitnessRecommendations(profile.goal),
    notes: [
      "Mentine hidratarea la 30-35ml/kg corp.",
      "Ajusteaza portiile cu +/-10% in functie de progresul la 2 saptamani.",
      profile.dietaryPrefs ? `Preferinte aplicate: ${profile.dietaryPrefs}` : "Preferinte implicite echilibrate.",
      profile.allergies ? `Alergii declarate: ${profile.allergies}` : "Fara alergii declarate.",
    ],
    warnings,
    disclaimer:
      "Acest plan este informativ si nu inlocuieste consultul medical/nutritionist. Pentru valori anormale sau afectiuni, cere avizul specialistului.",
    summary: `Plan 7 zile cu ${targets.kcal} kcal/zi, ${targets.protein}g proteine, ${targets.carbs}g carbohidrati si ${targets.fat}g grasimi.`,
  };
}

export function ensureSevenDayPlan(rawPlan, rawProfile, labsExtracted) {
  if (!rawPlan || typeof rawPlan !== "object") {
    return generateLocalPlan(rawProfile, labsExtracted);
  }

  const weeklyPlan = Array.isArray(rawPlan.weeklyPlan) ? rawPlan.weeklyPlan : [];
  if (weeklyPlan.length < 7) {
    return generateLocalPlan(rawProfile, labsExtracted);
  }

  const base = generateLocalPlan(rawProfile, labsExtracted);

  return {
    ...base,
    ...rawPlan,
    targets: {
      ...base.targets,
      ...(rawPlan.targets || {}),
    },
    weeklyPlan: rawPlan.weeklyPlan,
    shoppingList: Array.isArray(rawPlan.shoppingList) && rawPlan.shoppingList.length ? rawPlan.shoppingList : base.shoppingList,
    fitness: Array.isArray(rawPlan.fitness) && rawPlan.fitness.length ? rawPlan.fitness : base.fitness,
    notes: Array.isArray(rawPlan.notes) && rawPlan.notes.length ? rawPlan.notes : base.notes,
    warnings: Array.isArray(rawPlan.warnings) ? rawPlan.warnings : base.warnings,
    disclaimer: rawPlan.disclaimer || base.disclaimer,
    summary: rawPlan.summary || base.summary,
  };
}

