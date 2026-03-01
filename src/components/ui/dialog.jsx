import { createContext, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const DialogContext = createContext(null);

export function Dialog({ children, open, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;

  const setOpen = (next) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ isOpen, setOpen }), [isOpen]);

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ className, onClick, ...props }) {
  const ctx = useContext(DialogContext);

  return (
    <button
      type="button"
      className={cn("rounded-xl border border-slate-200 px-3 py-2 text-sm", className)}
      onClick={(event) => {
        onClick?.(event);
        ctx?.setOpen(true);
      }}
      {...props}
    />
  );
}

export function DialogContent({ className, children }) {
  const ctx = useContext(DialogContext);
  if (!ctx?.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={cn("w-full max-w-md rounded-2xl bg-white p-5 shadow-xl", className)}>
        {children}
      </div>
    </div>
  );
}

export function DialogClose({ className, ...props }) {
  const ctx = useContext(DialogContext);
  return (
    <button
      type="button"
      className={cn("rounded-lg bg-slate-100 px-3 py-2 text-sm", className)}
      onClick={() => ctx?.setOpen(false)}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <h4 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

