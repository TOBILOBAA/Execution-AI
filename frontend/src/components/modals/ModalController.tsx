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

  switch (activeModal) {
    case "add-category":
      return <AddCategoryModal {...props} />;
    case "add-yearly-goal":
      return <AddYearlyGoalModal open={true} onClose={closeModal} />;
    case "edit-yearly-goal":
      return <AddYearlyGoalModal open={true} onClose={closeModal} initialData={modalData as never} />;
    case "add-monthly-goal":
      return <AddMonthlyGoalModal {...props} />;
    case "edit-monthly-goal":
      return <AddMonthlyGoalModal {...props} initialData={modalData as never} />;
    case "add-weekly-goal":
      return <AddWeeklyGoalModal {...props} />;
    case "edit-weekly-goal":
      return <AddWeeklyGoalModal {...props} initialData={modalData as never} />;
    case "add-daily-priority":
      return <AddDailyPriorityModal {...props} mode="add" />;
    case "edit-daily-priority":
      return <AddDailyPriorityModal {...props} mode="edit" initialData={modalData as never} />;
    case "add-secondary-task":
      return <AddSecondaryTaskModal {...props} />;
    case "edit-secondary-task":
      return <AddSecondaryTaskModal {...props} initialData={modalData as never} />;
    case "manage-habits":
      return <ManageHabitsModal {...props} />;
    case "daily-report":
    case "weekly-report":
    case "monthly-report":
    case "yearly-report":
      return <ReportModal {...props} type={activeModal} data={modalData} />;
    default:
      return null;
  }
}
