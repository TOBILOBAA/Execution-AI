import React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: string;
  iconRight?: string;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "primary-gradient text-white font-bold shadow-sm hover:opacity-90 active:scale-[0.98]",
  secondary:
    "bg-white text-[--color-primary] border ghost-border hover:border-[--color-primary]/30 hover:bg-[--color-surface-container-low] shadow-sm active:scale-[0.98]",
  ghost:
    "bg-transparent text-[--color-on-surface-variant] hover:bg-[--color-surface-container-low] active:scale-[0.98]",
  danger:
    "bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-full gap-1.5",
  md: "px-4 py-2 text-xs rounded-full gap-2",
  lg: "px-6 py-3 text-sm rounded-full gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-bold tracking-wide transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        iconLeft && (
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {iconLeft}
          </span>
        )
      )}
      {children}
      {iconRight && !loading && (
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}
