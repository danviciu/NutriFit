import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function WizardStep3({ onSuggest, suggestion, suggestLoading }) {
  const { register, formState: { errors } } = useFormContext();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Preferinte alimentare</h2>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Preferinte alimentare</label>
        <Textarea {...register("dietaryPrefs")} placeholder="Ex: mediteranean, fara zahar rafinat, fara lactate" />
        {errors.dietaryPrefs ? <p className="text-xs font-semibold text-red-500">{errors.dietaryPrefs.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Alergii / intolerante</label>
        <Textarea {...register("allergies")} placeholder="Ex: arahide, gluten" />
        {errors.allergies ? <p className="text-xs font-semibold text-red-500">{errors.allergies.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Stil de viata</label>
        <Textarea
          {...register("lifestyle")}
          placeholder="Ex: program de birou, 3 antrenamente/saptamana, mers pe jos zilnic"
        />
        {errors.lifestyle ? <p className="text-xs font-semibold text-red-500">{errors.lifestyle.message}</p> : null}
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-800">Sugestie AI</p>
          <Button type="button" size="sm" variant="outline" onClick={onSuggest} disabled={suggestLoading}>
            {suggestLoading ? "Se genereaza..." : "Sugereaza cu AI"}
          </Button>
        </div>
        <p className="text-sm text-emerald-700">{suggestion || "Apasa butonul pentru o recomandare rapida."}</p>
      </div>
    </div>
  );
}
