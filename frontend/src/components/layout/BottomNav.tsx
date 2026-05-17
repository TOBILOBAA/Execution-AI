"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/goals", label: "Goals", icon: "target" },
  { href: "/dashboard/reports", label: "Reports", icon: "insert_chart" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "monitoring" },
];

export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden bg-white/90 backdrop-blur-md border-t border-[--color-outline-variant]/15 z-30"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                isActive
                  ? "text-[--color-primary]"
                  : "text-[--color-on-surface-variant]/60 hover:text-[--color-on-surface-variant]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-2xl",
                  isActive && "filled"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
      {/* iOS safe area */}
      <div className="h-safe-bottom bg-white/90" />
    </nav>
  );
}
