import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FitnessSection({ fitness }) {
  return (
    <Card className="neo-border rounded-3xl">
      <CardHeader>
        <CardTitle>Fitness</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-inside list-disc space-y-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-slate-700">
          {(fitness || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
