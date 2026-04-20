"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AddCategoryModalProps {
  onAdd: (name: string, icon: string) => void;
  onClose: () => void;
}

const ICON_OPTIONS = [
  "favorite",
  "work",
  "school",
  "person",
  "bar_chart",
  "fitness_center",
  "rocket_launch",
  "palette",
  "language",
  "auto_awesome",
  "lightbulb",
  "psychology",
];

export function AddCategoryModal({ onAdd, onClose }: AddCategoryModalProps) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("favorite");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    onAdd(name.trim(), selectedIcon);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.30)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-8 pt-8 pb-0">
          {/* Top icon */}
          <div className="flex justify-center mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "#006c4a" }}
            >
              <span className="material-symbols-outlined text-[26px] text-white">
                {selectedIcon}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-7">
            <h2 className="font-headline text-2xl font-bold text-[#1a1f1e] mb-1.5">
              New Initiative Bucket
            </h2>
            <p className="text-sm text-[#6b7b74] leading-relaxed max-w-xs mx-auto">
              Define a thematic area for your yearly execution. This helps in
              grouping your high-impact goals.
            </p>
          </div>

          {/* Category name */}
          <div className="mb-6">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6b7b74] mb-2">
              Category Name
            </label>
            <div className="relative">
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") onClose();
                }}
                placeholder="e.g., Spiritual Growth, Career Advancement..."
                className={cn(
                  "w-full pr-10 pl-4 py-3.5 rounded-xl border text-sm text-[#1a1f1e] placeholder:text-[#a8b5af] focus:outline-none transition",
                  error
                    ? "border-red-300 bg-red-50"
                    : "border-[#e2e8e4] bg-[#f7f9f8] focus:border-[#006c4a]"
                )}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-[#a8b5af]">
                edit
              </span>
            </div>
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          {/* Icon picker */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#6b7b74]">
                Category Icon
              </label>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a8b5af]">
                Choose a Visual Anchor
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {ICON_OPTIONS.map((icon) => {
                const isSelected = icon === selectedIcon;
                return (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setSelectedIcon(icon)}
                    className={cn(
                      "w-full aspect-square rounded-xl flex items-center justify-center transition-all",
                      isSelected
                        ? "border-2 border-[#006c4a] bg-white shadow-sm"
                        : "border border-[#e8ecea] bg-[#f7f9f8] hover:border-[#006c4a]/40 hover:bg-white"
                    )}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ color: isSelected ? "#006c4a" : "#5a6b65" }}
                    >
                      {icon}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-8 py-5 border-t border-[#f0f3f1]">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl border border-[#e2e8e4] text-sm font-semibold text-[#5a6b65] hover:bg-[#f7f9f8] transition"
          >
            Discard
          </button>
          <button
            onClick={handleCreate}
            className="flex-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#1a2b24", flexGrow: 2 }}
          >
            Create Category
          </button>
        </div>
      </div>
    </div>
  );
}
