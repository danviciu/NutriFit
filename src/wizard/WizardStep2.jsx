import { useFormContext } from "react-hook-form";
import { Select } from "@/components/ui/select";

const goalLabels = {
  lose: "Slabire",
  maintain: "Mentinere",
  gain: "Masa musculara",
};

export default function WizardStep2() {
  const { register, watch, setValue, formState: { errors } } = useFormContext();

  const goal = watch("goal");
  const goalDeltaKcal = watch("goalDeltaKcal");
  const sliderValue = Math.abs(goalDeltaKcal);
  const sliderMin = goal === "maintain" ? 0 : 100;
  const sliderMax = goal === "lose" ? 800 : goal === "gain" ? 600 : 0;

  const onSliderChange = (value) => {
    const numeric = Number(value);
    if (goal === "lose") setValue("goalDeltaKcal", -numeric);
    else if (goal === "gain") setValue("goalDeltaKcal", numeric);
    else setValue("goalDeltaKcal", 0);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Obiective</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Obiectiv principal</label>
          <Select
            value={goal}
            onChange={(event) => {
              const nextGoal = event.target.value;
              const delta = nextGoal === "lose" ? -500 : nextGoal === "gain" ? 300 : 0;
              setValue("goal", nextGoal);
              setValue("goalDeltaKcal", delta);
            }}
          >
            <option value="lose">Slabire</option>
            <option value="maintain">Mentinere</option>
            <option value="gain">Masa musculara</option>
          </Select>
          {errors.goal ? <p className="text-xs font-semibold text-red-500">{errors.goal.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Nivel activitate</label>
          <Select {...register("activityLevel")}>
            <option value="sedentary">Sedentar</option>
            <option value="light">Usor activ</option>
            <option value="moderate">Moderat</option>
            <option value="active">Foarte activ</option>
          </Select>
          {errors.activityLevel ? <p className="text-xs font-semibold text-red-500">{errors.activityLevel.message}</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <p className="font-medium text-emerald-800">{goalLabels[goal]}</p>
          <p className="text-emerald-700">
            {goal === "lose" ? `Deficit: ${sliderValue} kcal` : goal === "gain" ? `Surplus: +${sliderValue} kcal` : "Fara ajustare"}
          </p>
        </div>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          value={goal === "maintain" ? 0 : sliderValue}
          disabled={goal === "maintain"}
          onChange={(event) => onSliderChange(event.target.value)}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-200 accent-emerald-600 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
