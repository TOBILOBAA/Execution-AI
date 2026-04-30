"use client";

import Link from "next/link";

type GoalsHierarchyTab = "yearly" | "monthly" | "weekly" | "daily";

interface GoalsHierarchyNavProps {
  year: number;
  active: GoalsHierarchyTab;
  currentMonth?: number | null;
  currentWeekNumber?: number | null;
}

export function GoalsHierarchyNav({
  year,
  active,
  currentMonth,
  currentWeekNumber,
}: GoalsHierarchyNavProps) {
  const items = [
    { id: "yearly", label: "Yearly", href: `/dashboard/goals/${year}` },
    { id: "monthly", label: "Monthly", href: `/dashboard/goals/${year}/monthly` },
    {
      id: "weekly",
      label: "Weekly",
      href: `/dashboard/goals/${year}/weekly${currentMonth ? `?month=${currentMonth}` : ""}`,
    },
    {
      id: "daily",
      label: "Daily",
      href: `/dashboard/goals/${year}/daily${currentWeekNumber ? `?week=${currentWeekNumber}` : ""}`,
    },
  ] as const;

  return (
    <div
      className="rounded-[18px] p-1.5 flex flex-wrap gap-1.5"
      style={{
        background: "#f7faf8",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            className="px-3.5 py-2 rounded-[14px] text-sm font-bold transition-colors"
            style={{
              background: selected ? "#006c4a" : "transparent",
              color: selected ? "#ffffff" : "#5d6d67",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
