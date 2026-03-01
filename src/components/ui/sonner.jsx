import { cn } from "@/lib/utils";

// not used yet
export function Sonner({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
