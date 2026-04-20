"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";

const ICON_OPTIONS = [
  "business_center", "fitness_center", "psychology", "savings",
  "school", "favorite", "home", "travel_explore", "sports_soccer",
  "groups", "science", "art", "music_note", "restaurant",
];

interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddCategoryModal({ open, onClose }: AddCategoryModalProps) {
  const addCategory = useAppStore((state) => state.addCategory);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("business_center");
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    addCategory({ name: name.trim(), icon });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        title="New Initiative Bucket"
        subtitle="Define a thematic area for your yearly execution."
        icon="category"
        onClose={onClose}
        centered
      />
      <ModalBody className="space-y-6">
        <Input
          label="Category Name"
          placeholder="e.g., Spiritual Growth, Career Advancement..."
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          error={error}
        />
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]">
            Choose Icon
          </p>
          <div className="grid grid-cols-7 gap-2">
            {ICON_OPTIONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 ${
                  icon === ic
                    ? "bg-[--color-primary] text-white shadow-sm"
                    : "bg-[--color-surface-container-low] text-[--color-on-surface-variant] hover:bg-[--color-surface-container]"
                }`}
                aria-label={ic}
                title={ic}
              >
                <span className="material-symbols-outlined text-[18px]">{ic}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {name && (
          <div className="bg-[--color-surface-container-low] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[--color-primary-container]/30 text-[--color-primary] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">{icon}</span>
            </div>
            <span className="font-semibold text-[--color-on-surface] text-sm">{name}</span>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={handleSave}>Create Bucket</Button>
      </ModalFooter>
    </Modal>
  );
}
