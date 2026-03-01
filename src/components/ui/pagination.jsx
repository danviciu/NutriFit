import { cn } from "@/lib/utils";

// not used yet
export function Pagination({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
