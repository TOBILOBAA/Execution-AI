"use client";

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import type { MonthlyGoal } from "@/lib/types";
import { MONTH_NAMES } from "@/lib/mockData";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: MonthlyGoal;
  yearOverride?: number;
  monthOverride?: number;
  defaultIsMain?: boolean;
}

export function AddMonthlyGoalModal({
  open,
  onClose,
  initialData,
  yearOverride,
  monthOverride,
  defaultIsMain,
}: Props) {
  const addMonthlyGoal = useAppStore((state) => state.addMonthlyGoal);
  const updateMonthlyGoal = useAppStore((state) => state.updateMonthlyGoal);
  const yearlyGoals = useAppStore((state) => state.yearlyGoals);
  const activeDashboardDate = useAppStore((state) => state.activeDashboardDate);
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [yearlyGoalId, setYearlyGoalId] = useState(initialData?.yearlyGoalId ?? "");
  const [isMain, setIsMain] = useState(initialData?.isMain ?? defaultIsMain ?? true);
  const [error, setError] = useState("");

  const activeDashboardYear = Number(activeDashboardDate.slice(0, 4)) || new Date().getFullYear();
  const activeDashboardMonth = Number(activeDashboardDate.slice(5, 7)) || new Date().getMonth() + 1;
  const effectiveMonth = initialData?.month ?? monthOverride ?? activeDashboardMonth;
  const effectiveYear = initialData?.year ?? yearOverride ?? activeDashboardYear;
  const availableYearlyGoals = yearlyGoals.filter((goal) => goal.year === effectiveYear);

  useEffect(() => {
    if (!open) return;
    setTitle(initialData?.title ?? "");
    setDescription(initialData?.description ?? "");
    setYearlyGoalId(initialData?.yearlyGoalId ?? availableYearlyGoals[0]?.id ?? "");
    setIsMain(initialData?.isMain ?? defaultIsMain ?? true);
    setError("");
  }, [availableYearlyGoals, defaultIsMain, initialData, open]);

  const handleSave = () => {
    if (!title.trim()) { setError("Goal title is required"); return; }
    if (!yearlyGoalId) { setError("Pick a yearly goal first"); return; }
    if (isEdit && initialData) {
      updateMonthlyGoal(initialData.id, { title: title.trim(), description, isMain, yearlyGoalId });
    } else {
      const parentGoal = availableYearlyGoals.find((goal) => goal.id === yearlyGoalId);
      addMonthlyGoal({
        title: title.trim(),
        description,
        yearlyGoalId,
        categoryId: parentGoal?.categoryId,
        isMain,
        month: effectiveMonth,
        year: effectiveYear,
        status: "active",
        progress: 0,
        priority: isMain ? "high" : "medium",
      });
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        title={isEdit ? "Edit Monthly Goal" : "Add Monthly Goal"}
        subtitle={`${MONTH_NAMES[effectiveMonth - 1]} ${effectiveYear}`}
        icon="calendar_month"
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]">
            Yearly Goal
          </label>
          <div className="relative">
            <select
              value={yearlyGoalId}
              onChange={(e) => { setYearlyGoalId(e.target.value); setError(""); }}
              className="w-full bg-[--color-surface-container-low] rounded-lg px-4 py-3 text-sm text-[--color-on-surface] border border-transparent focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20 focus:bg-white transition-all duration-150"
            >
              {availableYearlyGoals.length === 0 ? (
                <option value="">Add a yearly goal first</option>
              ) : (
                <>
                  <option value="">Select a yearly goal</option>
                  {availableYearlyGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>{goal.title}</option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]">
            Priority Level
          </p>
          <div className="flex gap-2">
            {[
              { value: true, label: "Main Goal", desc: "High Priority" },
              { value: false, label: "Secondary Goal", desc: "Supporting" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setIsMain(opt.value)}
                className={`flex-1 p-3 rounded-xl border text-left transition-all duration-150 ${
                  isMain === opt.value
                    ? "border-[--color-primary] bg-emerald-50 text-[--color-primary]"
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
          placeholder="e.g., Ship onboarding flow and core dashboard"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(""); }}
          error={error}
        />
        <Textarea
          label="Description (optional)"
          placeholder="What does hitting this goal look like?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={handleSave} disabled={!yearlyGoalId}>
          {isEdit ? "Save Changes" : "Add Goal"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
