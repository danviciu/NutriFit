import { cn } from "@/lib/utils";

const variants = {
  default: "bg-teal-600 text-white shadow-[0_10px_22px_rgba(13,148,136,0.28)] hover:bg-teal-700",
  outline: "border border-white/80 bg-white/75 text-slate-700 hover:bg-white",
  secondary: "bg-emerald-50 text-teal-700 hover:bg-emerald-100",
  ghost: "text-slate-700 hover:bg-teal-50",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

const sizes = {
  sm: "h-8 rounded-xl px-3 text-xs",
  md: "h-10 rounded-2xl px-4 text-sm",
  lg: "h-11 rounded-2xl px-5 text-sm",
};

export function Button({ className, variant = "default", size = "md", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        className,
      )}
      {...props}
    />
  );
}

