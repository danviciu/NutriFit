import { cn } from "@/lib/utils";

const variants = {
  default: "bg-teal-600 text-white",
  soft: "bg-emerald-50 text-teal-700",
  outline: "border border-teal-200 text-teal-700",
  secondary: "bg-slate-100 text-slate-700",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant] || variants.default,
        className,
      )}
      {...props}
    />
  );
}

