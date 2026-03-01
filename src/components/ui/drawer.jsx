import { cn } from "@/lib/utils";

// not used yet
export function Drawer({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
