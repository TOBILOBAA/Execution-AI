"use client";

import { DashboardNextDayReview } from "./DashboardNextDayReview";

type PlanTomorrowModalProps = Parameters<typeof DashboardNextDayReview>[0];

/** Canonical plan-tomorrow state-machine step for the home funnel. */
export function PlanTomorrowModal(props: PlanTomorrowModalProps) {
  return <DashboardNextDayReview {...props} />;
}
