export class UserProfile {
  constructor(data = {}) {
    this.email = data.email || "local@nutrifit.ai";
    this.sex = data.sex || "female";
    this.age = Number(data.age || 30);
    this.heightCm = Number(data.heightCm || 170);
    this.weightKg = Number(data.weightKg || 70);
    this.goal = data.goal || "maintain";
    this.goalDeltaKcal = Number(data.goalDeltaKcal || 0);
    this.activityLevel = data.activityLevel || "moderate";
    this.dietaryPrefs = data.dietaryPrefs || "";
    this.allergies = data.allergies || "";
    this.labsText = data.labsText || "";
    this.labsFileName = data.labsFileName || "";
  }
}

