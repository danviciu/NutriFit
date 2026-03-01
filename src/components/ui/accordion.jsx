import { cn } from "@/lib/utils";

export function Accordion({ className, ...props }) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function AccordionItem({ className, ...props }) {
  return <div className={cn("rounded-md border", className)} {...props} />;
}

export function AccordionTrigger({ className, ...props }) {
  return <div className={cn("cursor-default px-4 py-3 text-sm font-medium", className)} {...props} />;
}

export function AccordionContent({ className, ...props }) {
  return <div className={cn("border-t px-4 py-3", className)} {...props} />;
}
