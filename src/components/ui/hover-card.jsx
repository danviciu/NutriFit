import { cn } from "@/lib/utils";

// not used yet
export function HoverCard({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
