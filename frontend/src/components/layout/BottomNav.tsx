"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/goals", label: "Goals", icon: "target" },
  { href: "/dashboard/reports", label: "Reports", icon: "insert_chart" },
];

export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className="mx-auto max-w-md rounded-[30px] px-2 pt-2"
        style={{
          background: "rgba(255,255,255,0.86)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 20px 44px rgba(7,20,15,0.14)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div className="flex items-stretch gap-1.5">
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
                  "flex-1 rounded-[22px] px-2 py-2.5 transition-all",
                  isActive
                    ? "text-[--color-primary]"
                    : "text-[--color-on-surface-variant]/65 hover:text-[--color-on-surface-variant]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="flex flex-col items-center justify-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border text-[22px] transition-all",
                      isActive
                        ? "border-[rgba(0,108,74,0.12)] bg-[rgba(0,108,74,0.1)] shadow-[0_10px_18px_rgba(0,108,74,0.12)]"
                        : "border-transparent bg-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "material-symbols-outlined",
                        isActive && "filled"
                      )}
                    >
                      {item.icon}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                    {item.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <div className="h-safe-bottom" />
      </div>
    </nav>
  );
}
