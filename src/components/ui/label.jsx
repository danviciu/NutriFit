import { cn } from "@/lib/utils";

export function Label({ className, ...props }) {
  return <label className={cn("text-sm font-semibold text-slate-800", className)} {...props} />;
}

