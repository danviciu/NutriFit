import { cn } from "@/lib/utils";

// not used yet
export function Collapsible({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
