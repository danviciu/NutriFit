import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }) {
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300", className)}
      {...props}
    />
  );
}

