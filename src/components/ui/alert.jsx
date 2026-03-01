import { cn } from "@/lib/utils";

export function Alert({ className, variant = "default", ...props }) {
  const tone =
    variant === "destructive"
      ? "border-red-100/90 bg-red-50/85 text-red-700"
      : "border-white/80 bg-white/75 text-teal-900 shadow-[0_8px_24px_rgba(13,148,136,0.08)]";

  return <div role="alert" className={cn("rounded-2xl border p-4", tone, className)} {...props} />;
}

export function AlertTitle({ className, ...props }) {
  return <h5 className={cn("font-semibold", className)} {...props} />;
}

export function AlertDescription({ className, ...props }) {
  return <div className={cn("mt-1 text-sm", className)} {...props} />;
}

