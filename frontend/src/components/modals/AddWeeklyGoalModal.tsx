"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import type { WeeklyGoal } from "@/lib/types";
import { CURRENT_WEEK, CURRENT_MONTH, CURRENT_YEAR } from "@/lib/mockData";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: WeeklyGoal;
}

export function AddWeeklyGoalModal({ open, onClose, initialData }: Props) {
  const addWeeklyGoal = useAppStore((state) => state.addWeeklyGoal);
  const updateWeeklyGoal = useAppStore((state) => state.updateWeeklyGoal);
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [isMain, setIsMain] = useState(initialData?.isMain ?? true);
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!title.trim()) { setError("Goal title is required"); return; }
    if (isEdit && initialData) {
      updateWeeklyGoal(initialData.id, { title: title.trim(), description, isMain });
    } else {
      addWeeklyGoal({
        title: title.trim(),
        description,
        isMain,
        weekNumber: CURRENT_WEEK,
        month: CURRENT_MONTH,
        year: CURRENT_YEAR,
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
        subtitle={`Week ${CURRENT_WEEK} Sprint`}
        icon="view_week"
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
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
        <Button variant="primary" size="md" onClick={handleSave}>
          {isEdit ? "Save Changes" : "Add Goal"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
