"use client";

import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { AddCategoryModal } from "./AddCategoryModal";
import { AddYearlyGoalModal } from "./AddYearlyGoalModal";
import { AddMonthlyGoalModal } from "./AddMonthlyGoalModal";
import { AddWeeklyGoalModal } from "./AddWeeklyGoalModal";
import { AddDailyPriorityModal as PlanningDailyPriorityModal } from "@/components/onboarding/AddDailyPriorityModal";
import { AddSecondaryTaskModal as PlanningSecondaryTaskModal } from "@/components/onboarding/AddSecondaryTaskModal";
import { ManageHabitsModal } from "./ManageHabitsModal";
import { ReportModal } from "./ReportModal";
import { getWeekNumber } from "@/lib/goalsView";
import type { Category, DailyPriority, MonthlyGoal, WeeklyGoal } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeLookup(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function inferWeeklyGoalId(item: { weeklyGoalId?: string; title?: string; description?: string }, weeklyGoals: WeeklyGoal[]) {
  if (item.weeklyGoalId && weeklyGoals.some((goal) => goal.id === item.weeklyGoalId)) {
    return item.weeklyGoalId;
  }

  const combined = normalizeLookup([item.title, item.description].filter(Boolean).join(" "));
  if (!combined) return undefined;
  const byContent = weeklyGoals.find((goal) => {
    const title = normalizeLookup(goal.title);
    return title && combined.includes(title);
  });
  return byContent?.id;
}

function inferCategoryId(
  item: { tag?: string; weeklyGoalId?: string; title?: string; description?: string },
  categories: Category[],
  weeklyGoals: WeeklyGoal[],
  monthlyGoals: MonthlyGoal[],
) {
  const tag = normalizeLookup(item.tag);
  if (tag) {
    const exact = categories.find((category) => normalizeLookup(category.name) === tag);
    if (exact) return exact.id;
    const fuzzy = categories.find((category) => {
      const name = normalizeLookup(category.name);
      return name && (name.includes(tag) || tag.includes(name));
    });
    if (fuzzy) return fuzzy.id;
  }

  const linkedWeeklyGoalId = inferWeeklyGoalId(item, weeklyGoals) ?? item.weeklyGoalId;
  const weeklyGoal = linkedWeeklyGoalId ? weeklyGoals.find((goal) => goal.id === linkedWeeklyGoalId) : undefined;
  const monthlyGoal = weeklyGoal?.monthlyGoalId
    ? monthlyGoals.find((goal) => goal.id === weeklyGoal.monthlyGoalId)
    : undefined;
  return monthlyGoal?.categoryId;
}

function ConnectedDailyPriorityModal({
  onClose,
  initialData,
}: {
  onClose: () => void;
  initialData?: DailyPriority;
}) {
  const {
    categories,
    weeklyGoals,
    monthlyGoals,
    sessionWeekStartsOn,
    activeDashboardDate,
    addDailyPriority,
    updateDailyPriority,
  } = useAppStore(
    useShallow((state) => ({
      categories: state.categories,
      weeklyGoals: state.weeklyGoals,
      monthlyGoals: state.monthlyGoals,
      sessionWeekStartsOn: state.sessionWeekStartsOn,
      activeDashboardDate: state.activeDashboardDate,
      addDailyPriority: state.addDailyPriority,
      updateDailyPriority: state.updateDailyPriority,
    })),
  );

  const referenceDate = initialData?.date ?? activeDashboardDate;
  const referenceYear = Number(referenceDate.slice(0, 4)) || new Date().getFullYear();
  const referenceDateSource = new Date(`${referenceDate}T12:00:00`);
  const referenceWeekNumber = Number.isNaN(referenceDateSource.getTime())
    ? getWeekNumber(new Date(), sessionWeekStartsOn)
    : getWeekNumber(referenceDateSource, sessionWeekStartsOn);
  const scopedWeeklyGoals = weeklyGoals.filter(
    (goal) => goal.year === referenceYear && goal.weekNumber === referenceWeekNumber,
  );
  const linkedWeeklyGoal =
    initialData?.weeklyGoalId ? weeklyGoals.find((goal) => goal.id === initialData.weeklyGoalId) : undefined;
  const availableWeeklyGoals =
    linkedWeeklyGoal && !scopedWeeklyGoals.some((goal) => goal.id === linkedWeeklyGoal.id)
      ? [...scopedWeeklyGoals, linkedWeeklyGoal]
      : scopedWeeklyGoals;
  const relevantMonthlyGoals = monthlyGoals.filter((goal) => goal.year === referenceYear);

  return (
    <PlanningDailyPriorityModal
      categories={categories}
      weeklyGoals={availableWeeklyGoals}
      initialTitle={initialData?.title}
      initialCategoryId={
        inferCategoryId(initialData ?? {}, categories, availableWeeklyGoals, relevantMonthlyGoals) ??
        categories.find((category) => category.name === initialData?.tag)?.id
      }
      initialWeeklyGoalId={inferWeeklyGoalId(initialData ?? {}, availableWeeklyGoals) ?? initialData?.weeklyGoalId}
      initialAllocation={initialData?.estimatedMinutes ?? 30}
      initialDescription={initialData?.description ?? ""}
      onSubmit={({ title, categoryId, estimatedMinutes, tag, weeklyGoalId, description }) => {
        if (initialData) {
          updateDailyPriority(initialData.id, {
            title,
            description,
            estimatedMinutes,
            weeklyGoalId,
            tag: tag ?? categories.find((category) => category.id === categoryId)?.name,
          });
        } else {
          addDailyPriority({
            title,
            description,
            estimatedMinutes,
            weeklyGoalId,
            tag: tag ?? categories.find((category) => category.id === categoryId)?.name,
            isMain: true,
            date: activeDashboardDate,
            status: "active",
            completed: false,
            priority: "high",
          });
        }
        onClose();
      }}
      onClose={onClose}
    />
  );
}

function ConnectedSecondaryTaskModal({
  onClose,
  initialData,
}: {
  onClose: () => void;
  initialData?: DailyPriority;
}) {
  const {
    categories,
    weeklyGoals,
    monthlyGoals,
    sessionWeekStartsOn,
    activeDashboardDate,
    addSecondaryTask,
    updateSecondaryTask,
  } = useAppStore(
    useShallow((state) => ({
      categories: state.categories,
      weeklyGoals: state.weeklyGoals,
      monthlyGoals: state.monthlyGoals,
      sessionWeekStartsOn: state.sessionWeekStartsOn,
      activeDashboardDate: state.activeDashboardDate,
      addSecondaryTask: state.addSecondaryTask,
      updateSecondaryTask: state.updateSecondaryTask,
    })),
  );

  const referenceDate = initialData?.date ?? activeDashboardDate;
  const referenceYear = Number(referenceDate.slice(0, 4)) || new Date().getFullYear();
  const referenceDateSource = new Date(`${referenceDate}T12:00:00`);
  const referenceWeekNumber = Number.isNaN(referenceDateSource.getTime())
    ? getWeekNumber(new Date(), sessionWeekStartsOn)
    : getWeekNumber(referenceDateSource, sessionWeekStartsOn);
  const scopedWeeklyGoals = weeklyGoals.filter(
    (goal) => goal.year === referenceYear && goal.weekNumber === referenceWeekNumber,
  );
  const linkedWeeklyGoal =
    initialData?.weeklyGoalId ? weeklyGoals.find((goal) => goal.id === initialData.weeklyGoalId) : undefined;
  const availableWeeklyGoals =
    linkedWeeklyGoal && !scopedWeeklyGoals.some((goal) => goal.id === linkedWeeklyGoal.id)
      ? [...scopedWeeklyGoals, linkedWeeklyGoal]
      : scopedWeeklyGoals;
  const relevantMonthlyGoals = monthlyGoals.filter((goal) => goal.year === referenceYear);

  return (
    <PlanningSecondaryTaskModal
      categories={categories}
      weeklyGoals={availableWeeklyGoals}
      initialTitle={initialData?.title}
      initialCategoryId={
        inferCategoryId(initialData ?? {}, categories, availableWeeklyGoals, relevantMonthlyGoals) ??
        categories.find((category) => category.name === initialData?.tag)?.id
      }
      initialWeeklyGoalId={inferWeeklyGoalId(initialData ?? {}, availableWeeklyGoals) ?? initialData?.weeklyGoalId}
      initialAllocation={initialData?.estimatedMinutes ?? 30}
      initialDescription={initialData?.description ?? ""}
      onSubmit={({ title, categoryId, estimatedMinutes, tag, weeklyGoalId, description }) => {
        if (initialData) {
          updateSecondaryTask(initialData.id, {
            title,
            description,
            estimatedMinutes,
            weeklyGoalId,
            tag: tag ?? categories.find((category) => category.id === categoryId)?.name,
          });
        } else {
          addSecondaryTask({
            title,
            description,
            estimatedMinutes,
            weeklyGoalId,
            tag: tag ?? categories.find((category) => category.id === categoryId)?.name,
            isMain: false,
            date: activeDashboardDate,
            status: "active",
            completed: false,
            priority: "medium",
          });
        }
        onClose();
      }}
      onClose={onClose}
    />
  );
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
      return <ConnectedDailyPriorityModal onClose={closeModal} initialData={(payload?.initialData ?? undefined) as never} />;
    case "edit-daily-priority":
      return <ConnectedDailyPriorityModal onClose={closeModal} initialData={(payload?.initialData ?? modalData) as never} />;
    case "add-secondary-task":
      return <ConnectedSecondaryTaskModal onClose={closeModal} initialData={(payload?.initialData ?? undefined) as never} />;
    case "edit-secondary-task":
      return <ConnectedSecondaryTaskModal onClose={closeModal} initialData={(payload?.initialData ?? modalData) as never} />;
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
