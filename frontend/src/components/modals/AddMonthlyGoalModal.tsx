"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import type { MonthlyGoal } from "@/lib/types";
import { CURRENT_MONTH, CURRENT_YEAR, MONTH_NAMES } from "@/lib/mockData";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: MonthlyGoal;
}

export function AddMonthlyGoalModal({ open, onClose, initialData }: Props) {
  const addMonthlyGoal = useAppStore((state) => state.addMonthlyGoal);
  const updateMonthlyGoal = useAppStore((state) => state.updateMonthlyGoal);
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [isMain, setIsMain] = useState(initialData?.isMain ?? true);
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!title.trim()) { setError("Goal title is required"); return; }
    if (isEdit && initialData) {
      updateMonthlyGoal(initialData.id, { title: title.trim(), description, isMain });
    } else {
      addMonthlyGoal({
        title: title.trim(),
        description,
        isMain,
        month: CURRENT_MONTH,
        year: CURRENT_YEAR,
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
        subtitle={`${MONTH_NAMES[CURRENT_MONTH - 1]} ${CURRENT_YEAR}`}
        icon="calendar_month"
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
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
        <Button variant="primary" size="md" onClick={handleSave}>
          {isEdit ? "Save Changes" : "Add Goal"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
