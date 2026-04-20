import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: string;
}

export function Input({
  label,
  hint,
  error,
  iconLeft,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span
            className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[--color-outline] text-[18px]"
            aria-hidden="true"
          >
            {iconLeft}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            "w-full bg-[--color-surface-container-low] rounded-lg px-4 py-3 text-sm text-[--color-on-surface]",
            "border border-transparent",
            "placeholder:text-[--color-on-surface-variant]/50",
            "focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20 focus:bg-white",
            "transition-all duration-150",
            iconLeft && "pl-10",
            error && "ring-1 ring-red-400",
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && (
        <p className="text-[11px] text-[--color-on-surface-variant]">{hint}</p>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={3}
        className={cn(
          "w-full bg-[--color-surface-container-low] rounded-lg px-4 py-3 text-sm text-[--color-on-surface]",
          "border border-transparent resize-none",
          "placeholder:text-[--color-on-surface-variant]/50",
          "focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20 focus:bg-white",
          "transition-all duration-150",
          error && "ring-1 ring-red-400",
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p className="text-[11px] text-[--color-on-surface-variant]">{hint}</p>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
