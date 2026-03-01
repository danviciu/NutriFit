import { cn } from "@/lib/utils";

// not used yet
export function Table({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
