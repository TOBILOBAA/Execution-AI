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
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        title={isEdit ? "Edit Weekly Goal" : "Add Weekly Goal"}
        subtitle={`Week ${effectiveWeek} Sprint`}
        icon="view_week"
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]">
            Monthly Goal
          </label>
          <div className="relative">
            <select
              value={monthlyGoalId}
              onChange={(e) => { setMonthlyGoalId(e.target.value); setError(""); }}
              className="w-full bg-[--color-surface-container-low] rounded-lg px-4 py-3 text-sm text-[--color-on-surface] border border-transparent focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20 focus:bg-white transition-all duration-150"
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
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { value: true, label: "Main Goal" },
            { value: false, label: "Secondary Goal" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setIsMain(opt.value)}
              className={`flex-1 py-2.5 px-4 rounded-lg border text-xs font-bold transition-all duration-150 ${
                isMain === opt.value
                  ? "border-[--color-primary] bg-emerald-50 text-[--color-primary]"
                  : "border-[--color-outline-variant]/20 bg-[--color-surface-container-low] text-[--color-on-surface-variant] hover:border-[--color-primary]/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
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
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={handleSave} disabled={!monthlyGoalId}>
          {isEdit ? "Save Changes" : "Add Goal"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
