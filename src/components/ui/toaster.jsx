import { cn } from "@/lib/utils";

// not used yet
export function Toaster({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
