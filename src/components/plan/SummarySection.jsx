import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SummarySection({ plan }) {
  return (
    <Card className="neo-border rounded-3xl">
      <CardHeader>
        <CardTitle>Rezumat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <p>{plan.summary}</p>
        <div className="keyline" />
        <ul className="list-inside list-disc space-y-1">
          {(plan.notes || []).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
