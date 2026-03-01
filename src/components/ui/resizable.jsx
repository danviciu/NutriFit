import { cn } from "@/lib/utils";

// not used yet
export function Resizable({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
