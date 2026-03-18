import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function safeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => safeText(item)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${safeText(item)}`)
      .join(", ");
  }
  return "";
}

export default function SummarySection({ plan }) {
  const summary = safeText(plan?.summary) || "Fara rezumat disponibil.";
  const notes = Array.isArray(plan?.notes)
    ? plan.notes.map((note) => safeText(note)).filter(Boolean)
    : [];

  return (
    <Card className="neo-border rounded-3xl">
      <CardHeader>
        <CardTitle>Rezumat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <p>{summary}</p>
        <div className="keyline" />
        <ul className="list-inside list-disc space-y-1">
          {notes.map((note, index) => (
            <li key={`${index}-${note.slice(0, 32)}`}>{note}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
