import { useFormContext } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

export default function WizardStep4({ onUploadFile, uploading, extractedLabs }) {
  const { register, setValue, watch } = useFormContext();
  const fileName = watch("labsFileName");

  const summaryCount = extractedLabs
    ? Object.values(extractedLabs?.extracted_json?.panels || {}).reduce((sum, entries) => sum + (entries?.length || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Analize medicale</h2>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Incarca analize (.pdf, .doc, .docx, .jpg, .png)</label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.png"
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setValue("labsFileName", file.name);
            onUploadFile(file);
          }}
          disabled={uploading}
        />
        <p className="text-xs text-slate-500">Format acceptat: PDF, DOCX, JPG, PNG (maxim 10MB)</p>
        {fileName ? <p className="text-xs font-semibold text-teal-700">Fisier selectat: {fileName}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Observatii suplimentare</label>
        <Textarea
          id="labsText"
          {...register("labsText")}
          placeholder="Optional: mentioneaza simptome sau context medical relevant."
        />
      </div>

      {uploading ? <p className="text-xs text-teal-700">Se proceseaza fisierul...</p> : null}

      {extractedLabs ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-medium">Extractie finalizata: {summaryCount} valori detectate</p>
          <p className="mt-1">Incredere: {extractedLabs.confidence?.overall || "unknown"}</p>
        </div>
      ) : null}

      <Alert>
        <AlertTitle>Mod auto activ</AlertTitle>
        <AlertDescription>
          Daca nu incarci analize, sistemul foloseste reguli standard si marcheaza sectiunea ca "Analize folosite (auto)".
        </AlertDescription>
      </Alert>
    </div>
  );
}