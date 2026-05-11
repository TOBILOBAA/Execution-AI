"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Modal({
  open,
  onClose,
  children,
  size = "md",
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Scrim */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-[--color-on-surface]/20 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className={cn(
          "relative z-10 w-full glass-panel rounded-xl",
          "shadow-[0px_24px_48px_-12px_rgba(43,52,55,0.18)]",
          "flex flex-col max-h-[90vh] animate-slide-in-bottom",
          maxWidth,
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  onClose: () => void;
  centered?: boolean;
}

export function ModalHeader({
  title,
  subtitle,
  icon,
  onClose,
  centered = false,
}: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "px-8 pt-8 pb-6 border-b border-[--color-outline-variant]/10",
        centered && "text-center"
      )}
    >
      {icon && (
        <div
          className={cn(
            "mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-[--color-primary-container]/20 text-[--color-primary]",
            centered ? "mx-auto" : ""
          )}
        >
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
      )}
      <div
        className={cn(
          "flex items-start",
          centered ? "justify-center" : "justify-between"
        )}
      >
        <div>
          <h2 className="font-headline font-bold text-xl text-[--color-on-surface] tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-[--color-on-surface-variant] mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {!centered && (
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-full hover:bg-[--color-surface-container-low] transition-colors text-[--color-on-surface-variant] flex-shrink-0"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>
      {centered && (
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-[--color-surface-container-low] transition-colors text-[--color-on-surface-variant]"
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      )}
    </div>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-8 py-6", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-8 py-6 border-t border-[--color-outline-variant]/10 flex items-center justify-end gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}
