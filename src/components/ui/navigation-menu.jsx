import { cn } from "@/lib/utils";

// not used yet
export function NavigationMenu({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
