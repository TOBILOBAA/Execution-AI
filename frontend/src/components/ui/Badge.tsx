import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "surface" | "success" | "warning" | "danger" | "ai";
  className?: string;
}

const variantStyles = {
  primary:
    "bg-[--color-primary]/10 text-[--color-primary]",
  surface:
    "bg-[--color-surface-container] text-[--color-on-surface-variant]",
  success:
    "bg-emerald-50 text-emerald-700",
  warning:
    "bg-amber-50 text-amber-600",
  danger:
    "bg-red-50 text-red-600",
  ai:
    "bg-[--color-primary-container]/30 text-[--color-primary] border border-[--color-primary]/20",
};

export function Badge({ children, variant = "surface", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
