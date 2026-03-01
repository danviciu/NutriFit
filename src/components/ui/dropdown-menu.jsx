import { cn } from "@/lib/utils";

// not used yet
export function DropdownMenu({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
