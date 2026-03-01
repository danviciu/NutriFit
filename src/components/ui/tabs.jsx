import { createContext, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const TabsContext = createContext(null);

export function Tabs({ className, value, defaultValue, onValueChange, children }) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");

  const activeValue = value ?? internalValue;

  const contextValue = useMemo(
    () => ({
      value: activeValue,
      setValue: (nextValue) => {
        if (value === undefined) setInternalValue(nextValue);
        onValueChange?.(nextValue);
      },
    }),
    [activeValue, onValueChange, value],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-2 rounded-full border border-white/90 bg-white/88 p-1.5 shadow-[0_8px_20px_rgba(13,148,136,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, value, children, ...props }) {
  const ctx = useContext(TabsContext);
  const isActive = ctx?.value === value;

  return (
    <button
      type="button"
      className={cn(
        "rounded-full px-4 py-2 text-[15px] font-semibold transition",
        isActive
          ? "bg-gradient-to-r from-teal-600 to-emerald-500 text-white shadow-[0_8px_18px_rgba(13,148,136,0.32)]"
          : "bg-transparent text-slate-800 hover:bg-white hover:text-teal-800",
        className,
      )}
      onClick={() => ctx?.setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ className, value, ...props }) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;

  return <div className={cn(className)} {...props} />;
}

