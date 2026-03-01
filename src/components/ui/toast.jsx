import { cn } from "@/lib/utils";

// not used yet
export function Toast({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
