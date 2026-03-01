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
    <div className="glass-card rounded-[32px] p-8 md:p-12">
      <div className="mx-auto mb-10 max-w-xl text-center">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Analize sange</h1>
        <p className="leading-relaxed text-slate-600">
          Incarca analizele medicale pentru ca AI-ul sa genereze un plan nutritional de precizie.
        </p>
      </div>

      <label className="group relative mb-8 block cursor-pointer rounded-[24px] p-12 text-center transition-all duration-300 hover:bg-teal-50/50 upload-dashed">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.png"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setValue("labsFileName", file.name);
            onUploadFile(file);
          }}
          disabled={uploading}
        />
        <div className="relative z-0">
          <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 transition-transform duration-300 group-hover:scale-110">
            <span className="text-4xl">⬆</span>
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-800">Trage fisierele aici sau apasa pentru selectie</h3>
          <p className="mb-4 text-sm text-slate-500">Format acceptat: PDF, DOCX, JPG, PNG (maxim 10MB)</p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="rounded-full border border-teal-100 bg-white px-3 py-1 text-xs font-medium text-teal-700">
              Max 10MB
            </span>
            <span className="rounded-full border border-teal-100 bg-white px-3 py-1 text-xs font-medium text-teal-700">
              Ultimul an recomandat
            </span>
          </div>
          {fileName ? <p className="mt-4 text-sm font-semibold text-teal-700">Fisier selectat: {fileName}</p> : null}
        </div>
      </label>

      <div className="mb-10 flex items-center justify-center gap-6 border-y border-teal-50 py-4">
        <div className="flex items-center gap-2 text-teal-800">
          <span className="text-teal-500">✔</span>
          <span className="text-xs font-bold uppercase tracking-widest">Medical Security Pro</span>
        </div>
        <div className="h-4 w-px bg-teal-200" />
        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-sm">🔒</span>
          <span className="text-xs">Datele sunt criptate end-to-end</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Observatii suplimentare</label>
        <Textarea
          id="labsText"
          {...register("labsText")}
          placeholder="Optional: mentioneaza simptome sau context medical relevant."
        />
      </div>

      {uploading ? <p className="mt-3 text-xs text-teal-700">Se proceseaza fisierul...</p> : null}

      {extractedLabs ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-medium">Extractie finalizata: {summaryCount} valori detectate</p>
          <p className="mt-1">Incredere: {extractedLabs.confidence?.overall || "unknown"}</p>
        </div>
      ) : null}

      <Alert className="mt-4">
        <AlertTitle>Mod auto activ</AlertTitle>
        <AlertDescription>
          Daca nu incarci analize, sistemul foloseste reguli standard si marcheaza sectiunea ca "Analize folosite (auto)".
        </AlertDescription>
      </Alert>
    </div>
  );
}
