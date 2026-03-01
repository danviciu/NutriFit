import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LabsSection({ labs }) {
  if (!labs) {
    return (
      <Card className="neo-border rounded-3xl">
        <CardHeader>
          <CardTitle>Analize</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">Nu exista analize incarcate. Mod auto activ.</CardContent>
      </Card>
    );
  }

  const normalizedLabs = labs.panels
    ? labs
    : labs.extracted_json?.panels
      ? labs.extracted_json
      : labs.extracted?.panels
        ? labs.extracted
        : labs;

  const panels = normalizedLabs.panels || {};
  const count = Object.values(panels).reduce((sum, list) => sum + (list?.length || 0), 0);

  return (
    <Card className="neo-border rounded-3xl">
      <CardHeader>
        <CardTitle>Analize</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <div className="data-pill">
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Valori structurate</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{count}</p>
        </div>

        {(normalizedLabs.warnings || []).length ? (
          <ul className="list-inside list-disc space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
            {(normalizedLabs.warnings || []).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            {count > 0 ? "Fara avertismente specifice." : "Analize incarcate, dar nu s-au extras valori relevante."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
