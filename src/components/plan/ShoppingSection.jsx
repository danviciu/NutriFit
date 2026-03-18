import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ShoppingSection({ shoppingList }) {
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    setCheckedItems({});
  }, [shoppingList]);

  const normalizedItems = useMemo(
    () =>
      (shoppingList || [])
        .map((item, index) => {
          const label = String(item?.item || item?.name || "")
            .replace(/\[\s*\]/g, "")
            .replace(/^[\-\*\s]+/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (!label) return null;
          const quantity = String(item?.quantity || item?.amount || "").trim() || "1 buc";
          return {
            key: `${label.toLowerCase()}-${index}`,
            label,
            quantity,
          };
        })
        .filter(Boolean),
    [shoppingList],
  );

  const checkedCount = normalizedItems.filter((entry) => checkedItems[entry.key]).length;

  const toggleItem = (key) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <Card className="neo-border rounded-3xl">
      <CardHeader>
        <CardTitle>Cumparaturi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Bifate: {checkedCount}/{normalizedItems.length}
        </div>
        <ul className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-slate-700">
          {(normalizedItems.length ? normalizedItems : [{ key: "empty", label: "Lista goala", quantity: "-" }]).map((item) => (
            <li key={item.key}>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={Boolean(checkedItems[item.key])}
                    onChange={() => toggleItem(item.key)}
                    disabled={item.key === "empty"}
                  />
                  <span>{item.label}</span>
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {item.quantity}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
