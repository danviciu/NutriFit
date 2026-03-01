import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WizardStep1() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const sex = watch("sex");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Profil fizic</h2>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Sex biologic</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={sex === "male" ? "default" : "outline"}
            onClick={() => setValue("sex", "male")}
          >
            Masculin
          </Button>
          <Button
            type="button"
            variant={sex === "female" ? "default" : "outline"}
            onClick={() => setValue("sex", "female")}
          >
            Feminin
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Varsta</label>
          <Input type="number" {...register("age")} />
          {errors.age ? <p className="text-xs font-semibold text-red-500">{errors.age.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Inaltime (cm)</label>
          <Input type="number" {...register("heightCm")} />
          {errors.heightCm ? <p className="text-xs font-semibold text-red-500">{errors.heightCm.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Greutate (kg)</label>
          <Input type="number" {...register("weightKg")} />
          {errors.weightKg ? <p className="text-xs font-semibold text-red-500">{errors.weightKg.message}</p> : null}
        </div>
      </div>
    </div>
  );
}
