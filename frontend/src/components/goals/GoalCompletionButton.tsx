"use client";

interface GoalCompletionButtonProps {
  completed: boolean;
  onClick: () => void;
  compact?: boolean;
  disabled?: boolean;
}

export function GoalCompletionButton({
  completed,
  onClick,
  compact = false,
  disabled = false,
}: GoalCompletionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        compact
          ? "h-10 px-3 rounded-xl inline-flex items-center justify-center text-xs font-semibold disabled:cursor-not-allowed"
          : "inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold disabled:cursor-not-allowed"
      }
      style={{
        background: disabled
          ? "rgba(148,163,184,0.12)"
          : completed
            ? "rgba(0,108,74,0.09)"
            : "#f7faf8",
        border: disabled
          ? "1px solid rgba(148,163,184,0.18)"
          : completed
            ? "1px solid rgba(0,108,74,0.16)"
            : "1px solid rgba(0,0,0,0.08)",
        color: disabled ? "#8a9e97" : completed ? "#006c4a" : "#4b635b",
        opacity: disabled ? 0.72 : 1,
      }}
      aria-label={completed ? "Mark goal incomplete" : "Mark goal complete"}
    >
      <span className="material-symbols-outlined text-[15px]">
        {completed ? "task_alt" : "check_circle"}
      </span>
      {!compact && (completed ? "Completed" : "Mark complete")}
    </button>
  );
}
