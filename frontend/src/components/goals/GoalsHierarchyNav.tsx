"use client";

import Link from "next/link";

type GoalsHierarchyTab = "yearly" | "monthly" | "weekly" | "daily";

interface GoalsHierarchyNavProps {
  year: number;
  active: GoalsHierarchyTab;
}

export function GoalsHierarchyNav({
  year,
  active,
}: GoalsHierarchyNavProps) {
  const items = [
    { id: "yearly", label: "Yearly", href: `/dashboard/goals/${year}` },
    { id: "monthly", label: "Monthly", href: `/dashboard/goals/${year}/monthly` },
    { id: "weekly", label: "Weekly", href: `/dashboard/goals/${year}/weekly` },
    { id: "daily", label: "Daily", href: `/dashboard/goals/${year}/daily` },
  ] as const;

  return (
    <div
      className="flex gap-1.5 overflow-x-auto rounded-[18px] p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            className="min-w-[88px] shrink-0 px-3.5 py-2 text-center rounded-[14px] text-sm font-bold transition-colors"
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
