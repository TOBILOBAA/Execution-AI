"use client";

import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { AddCategoryModal } from "./AddCategoryModal";
import { AddYearlyGoalModal } from "./AddYearlyGoalModal";
import { AddMonthlyGoalModal } from "./AddMonthlyGoalModal";
import { AddWeeklyGoalModal } from "./AddWeeklyGoalModal";
import { AddDailyPriorityModal } from "./AddDailyPriorityModal";
import { AddSecondaryTaskModal } from "./AddSecondaryTaskModal";
import { ManageHabitsModal } from "./ManageHabitsModal";
import { ReportModal } from "./ReportModal";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ModalController() {
  const { activeModal, modalData, closeModal } = useAppStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      modalData: state.modalData,
      closeModal: state.closeModal,
    })),
  );

  if (!activeModal) return null;

  const props = { open: true, onClose: closeModal };
  const payload = isRecord(modalData) ? modalData : null;

  switch (activeModal) {
    case "add-category":
      return <AddCategoryModal {...props} />;
    case "add-yearly-goal":
      return <AddYearlyGoalModal open={true} onClose={closeModal} />;
    case "edit-yearly-goal":
      return <AddYearlyGoalModal open={true} onClose={closeModal} initialData={modalData as never} />;
    case "add-monthly-goal":
      return (
        <AddMonthlyGoalModal
          {...props}
          yearOverride={typeof payload?.yearOverride === "number" ? payload.yearOverride : undefined}
          monthOverride={typeof payload?.monthOverride === "number" ? payload.monthOverride : undefined}
          defaultIsMain={typeof payload?.defaultIsMain === "boolean" ? payload.defaultIsMain : undefined}
        />
      );
    case "edit-monthly-goal":
      return <AddMonthlyGoalModal {...props} initialData={(payload?.initialData ?? modalData) as never} />;
    case "add-weekly-goal":
      return (
        <AddWeeklyGoalModal
          {...props}
          yearOverride={typeof payload?.yearOverride === "number" ? payload.yearOverride : undefined}
          monthOverride={typeof payload?.monthOverride === "number" ? payload.monthOverride : undefined}
          weekOverride={typeof payload?.weekOverride === "number" ? payload.weekOverride : undefined}
          defaultIsMain={typeof payload?.defaultIsMain === "boolean" ? payload.defaultIsMain : undefined}
        />
      );
    case "edit-weekly-goal":
      return <AddWeeklyGoalModal {...props} initialData={(payload?.initialData ?? modalData) as never} />;
    case "add-daily-priority":
      return <AddDailyPriorityModal {...props} mode="add" initialData={(payload?.initialData ?? undefined) as never} />;
    case "edit-daily-priority":
      return <AddDailyPriorityModal {...props} mode="edit" initialData={(payload?.initialData ?? modalData) as never} />;
    case "add-secondary-task":
      return <AddSecondaryTaskModal {...props} initialData={(payload?.initialData ?? undefined) as never} />;
    case "edit-secondary-task":
      return <AddSecondaryTaskModal {...props} initialData={(payload?.initialData ?? modalData) as never} />;
    case "manage-habits":
      return <ManageHabitsModal {...props} />;
    case "daily-report":
    case "quarterly-report":
    case "weekly-report":
    case "monthly-report":
    case "yearly-report":
      return <ReportModal {...props} type={activeModal} data={modalData} />;
    default:
      return null;
  }
}
