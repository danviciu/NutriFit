import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-2xl border border-slate-300/80 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

