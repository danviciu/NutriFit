import { cn } from "@/lib/utils";

// not used yet
export function Command({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
