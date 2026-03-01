import { cn } from "@/lib/utils";

export function Progress({ className, value = 0 }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-teal-100/70", className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-600 transition-all" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

