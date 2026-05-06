"use client";

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import type { WeeklyGoal } from "@/lib/types";
import { getWeekNumber } from "@/lib/goalsView";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: WeeklyGoal;
  yearOverride?: number;
  monthOverride?: number;
  weekOverride?: number;
  defaultIsMain?: boolean;
}

export function AddWeeklyGoalModal({
  open,
  onClose,
  initialData,
  yearOverride,
  monthOverride,
  weekOverride,
  defaultIsMain,
}: Props) {
  const addWeeklyGoal = useAppStore((state) => state.addWeeklyGoal);
  const updateWeeklyGoal = useAppStore((state) => state.updateWeeklyGoal);
  const monthlyGoals = useAppStore((state) => state.monthlyGoals);
  const sessionWeekStartsOn = useAppStore((state) => state.sessionWeekStartsOn);
  const activeDashboardDate = useAppStore((state) => state.activeDashboardDate);
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [monthlyGoalId, setMonthlyGoalId] = useState(initialData?.monthlyGoalId ?? "");
  const [isMain, setIsMain] = useState(initialData?.isMain ?? defaultIsMain ?? true);
  const [error, setError] = useState("");

  const activeDashboardReference = new Date(`${activeDashboardDate}T12:00:00`);
  const activeDashboardYear = Number(activeDashboardDate.slice(0, 4)) || new Date().getFullYear();
  const activeDashboardMonth = Number(activeDashboardDate.slice(5, 7)) || new Date().getMonth() + 1;
  const activeDashboardWeek = Number.isNaN(activeDashboardReference.getTime())
    ? getWeekNumber(new Date(), sessionWeekStartsOn)
    : getWeekNumber(activeDashboardReference, sessionWeekStartsOn);
  const effectiveWeek = initialData?.weekNumber ?? weekOverride ?? activeDashboardWeek;
  const effectiveMonth = initialData?.month ?? monthOverride ?? activeDashboardMonth;
  const effectiveYear = initialData?.year ?? yearOverride ?? activeDashboardYear;
  const availableMonthlyGoals = monthlyGoals.filter((goal) => goal.year === effectiveYear && goal.month === effectiveMonth);

  useEffect(() => {
    if (!open) return;
    setTitle(initialData?.title ?? "");
    setDescription(initialData?.description ?? "");
    setMonthlyGoalId(initialData?.monthlyGoalId ?? availableMonthlyGoals[0]?.id ?? "");
    setIsMain(initialData?.isMain ?? defaultIsMain ?? true);
    setError("");
  }, [availableMonthlyGoals, defaultIsMain, initialData, open]);

  const handleSave = () => {
    if (!title.trim()) { setError("Goal title is required"); return; }
    if (!monthlyGoalId) { setError("Pick a monthly goal first"); return; }
    if (isEdit && initialData) {
      updateWeeklyGoal(initialData.id, { title: title.trim(), description, isMain, monthlyGoalId });
    } else {
      addWeeklyGoal({
        title: title.trim(),
        description,
        monthlyGoalId,
        isMain,
        weekNumber: effectiveWeek,
        month: effectiveMonth,
        year: effectiveYear,
        status: "active",
        progress: 0,
      });
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader
        title={isEdit ? "Edit Weekly Goal" : "Add Weekly Goal"}
        subtitle={`Week ${effectiveWeek} Sprint`}
        icon="view_week"
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
        <div
          className="rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg, rgba(0,108,74,0.08), rgba(255,255,255,0.96))", border: "1px solid rgba(0,108,74,0.12)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#006c4a" }}>
            Sprint window
          </p>
          <h3 className="mt-2 text-base font-bold" style={{ color: "#1a1f1e" }}>
            Week {effectiveWeek} · {effectiveYear}
          </h3>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "#5d6d67" }}>
            Tie this sprint goal to the monthly goal it supports, then decide whether it is the main commitment or a supporting target for the week.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]">
            Monthly Goal
          </label>
          <div
            className="relative rounded-2xl p-1"
            style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <select
              value={monthlyGoalId}
              disabled={availableMonthlyGoals.length === 0}
              onChange={(e) => { setMonthlyGoalId(e.target.value); setError(""); }}
              className="w-full appearance-none bg-transparent rounded-[14px] px-4 py-3 text-sm text-[--color-on-surface] outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {availableMonthlyGoals.length === 0 ? (
                <option value="">Add a monthly goal first</option>
              ) : (
                <>
                  <option value="">Select a monthly goal</option>
                  {availableMonthlyGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>{goal.title}</option>
                  ))}
                </>
              )}
            </select>
            <span
              className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px]"
              style={{ color: "#8a9e97" }}
            >
              expand_more
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]">
            Goal role
          </p>
          <div className="flex gap-2">
          {[
            { value: true, label: "Main Goal", desc: "This week’s core objective" },
            { value: false, label: "Supporting Goal", desc: "Support work around the main sprint" },
          ].map((opt) => (
            <button
              type="button"
              key={String(opt.value)}
              onClick={() => setIsMain(opt.value)}
              className={`flex-1 p-3 rounded-xl border text-left transition-all duration-150 ${
                isMain === opt.value
                  ? "border-[--color-primary] bg-emerald-50 text-[--color-primary] shadow-[0_10px_24px_rgba(0,108,74,0.10)]"
                  : "border-[--color-outline-variant]/20 bg-[--color-surface-container-low] text-[--color-on-surface-variant] hover:border-[--color-primary]/30"
              }`}
            >
              <p className="text-xs font-bold">{opt.label}</p>
              <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
            </button>
          ))}
        </div>
        </div>
        <Input
          label="Goal Title"
          placeholder="e.g., Complete Goals tab UI implementation"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(""); }}
          error={error}
        />
        <Textarea
          label="Description (optional)"
          placeholder="What does achieving this goal look like?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error ? (
          <p className="text-sm font-medium" style={{ color: "#b42318" }}>
            {error}
          </p>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={handleSave} disabled={!monthlyGoalId}>
          {isEdit ? "Save Weekly Goal" : "Create Weekly Goal"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
