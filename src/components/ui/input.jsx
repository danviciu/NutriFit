import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full rounded-2xl border border-slate-300/80 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-100",
        className,
      )}
      {...props}
    />
  );
}

