import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NutritionSection({ weeklyPlan }) {
  return (
    <Card className="neo-border rounded-3xl">
      <CardHeader>
        <CardTitle>Alimentatie (7 zile)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(weeklyPlan || []).map((day) => (
          <div key={day.day} className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <h4 className="mb-2 text-base font-semibold text-slate-900">{day.day}</h4>
            <div className="space-y-2">
              {(day.meals || []).map((meal) => (
                <div key={`${day.day}-${meal.slot}`} className="rounded-xl border border-white/80 bg-white/85 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{meal.slot}</p>
                  <ul className="mt-1 list-inside list-disc">
                    {(meal.foods || []).map((food) => (
                      <li key={`${day.day}-${meal.slot}-${food}`}>{food}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
