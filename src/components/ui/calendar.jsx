import { cn } from "@/lib/utils";

// not used yet
export function Calendar({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
