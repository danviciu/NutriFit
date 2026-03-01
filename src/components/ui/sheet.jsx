import { cn } from "@/lib/utils";

// not used yet
export function Sheet({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
