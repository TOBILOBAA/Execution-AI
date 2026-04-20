"use client";

import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** Six single-digit fields with paste and keyboard navigation. */
export function OtpCodeInput({ value, onChange, disabled, autoFocus }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.replace(/\D/g, "").slice(0, LENGTH);
  const chars = digits.split("");
  while (chars.length < LENGTH) chars.push("");

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(LENGTH - 1, i))];
    el?.focus();
    el?.select();
  };

  const commitDigits = useCallback(
    (raw: string) => {
      const next = raw.replace(/\D/g, "").slice(0, LENGTH);
      onChange(next);
      return next.length;
    },
    [onChange],
  );

  const handleChange = (index: number, input: string) => {
    if (disabled) return;
    const d = input.replace(/\D/g, "");
    if (d.length === 0) {
      const next = (digits.slice(0, index) + digits.slice(index + 1)).slice(0, LENGTH);
      onChange(next);
      return;
    }
    if (d.length >= LENGTH) {
      const len = commitDigits(d);
      focusAt(len >= LENGTH ? LENGTH - 1 : len);
      return;
    }
    const next = (digits.slice(0, index) + d.slice(-1) + digits.slice(index + 1)).slice(0, LENGTH);
    onChange(next);
    if (d) focusAt(index + 1);
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "Backspace") {
      if (chars[index]) {
        e.preventDefault();
        handleChange(index, "");
      } else if (index > 0) {
        e.preventDefault();
        focusAt(index - 1);
        handleChange(index - 1, "");
      }
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === "ArrowRight" && index < LENGTH - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const text = e.clipboardData.getData("text");
    if (!/\d/.test(text)) return;
    e.preventDefault();
    const len = commitDigits(text);
    focusAt(Math.min(len, LENGTH - 1));
  };

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="One-time code">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          value={chars[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className="w-10 h-12 text-center text-lg font-bold rounded-xl outline-none transition-all"
          style={{
            border: "1.5px solid rgba(0,0,0,0.1)",
            color: "#1a1f1e",
            background: "#fafcfb",
          }}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
        />
      ))}
    </div>
  );
}
