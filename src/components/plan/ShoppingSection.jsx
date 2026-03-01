import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ShoppingSection({ shoppingList }) {
  return (
    <Card className="neo-border rounded-3xl">
      <CardHeader>
        <CardTitle>Cumparaturi</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-inside list-disc space-y-1 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-slate-700">
          {(shoppingList || []).map((item) => (
            <li key={item.item || item.name}>
              {item.item || item.name}: {item.quantity || item.amount}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
