"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { BetaBadge } from "@/components/ui/BetaBadge";

const NAV_ITEMS = [
  { href: "/dashboard",         label: "Home",    icon: "home",          activeIcon: "home" },
  { href: "/dashboard/goals",   label: "Goals",   icon: "target",        activeIcon: "target" },
  { href: "/dashboard/reports", label: "Reports", icon: "insert_chart",  activeIcon: "insert_chart" },
];

export function Sidebar() {
  const pathname  = usePathname() ?? "";
  const router    = useRouter();
  const { currentUser, signOut } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      signOut: state.signOut,
    })),
  );
  const [showSignOut, setShowSignOut] = useState(false);

  const handleSignOut = () => {
    void signOut();
    router.replace("/auth");
  };

  const initials = currentUser?.name
    ? currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 bg-white sticky top-0 flex-shrink-0 z-30">
      {/* Brand */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-center gap-2">
          <h1 className="font-headline text-xl font-extrabold tracking-tighter" style={{ color: "#006c4a" }}>
            Execution AI
          </h1>
          <BetaBadge compact />
        </div>
        <p className="text-[10px] uppercase tracking-widest font-bold mt-0.5" style={{ color: "rgba(107,124,117,0.6)" }}>
          Your Execution Engine
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1" aria-label="Main navigation">
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
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-emerald-50 font-semibold"
                  : "hover:bg-gray-50"
              )}
              style={{ color: isActive ? "#006c4a" : "#6b7c75" }}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="material-symbols-outlined text-[22px]">
                {isActive ? item.activeIcon : item.icon}
              </span>
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-5 rounded-full" style={{ background: "#006c4a" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div
          className="relative flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all group"
          style={{ background: showSignOut ? "rgba(0,108,74,0.05)" : "transparent" }}
          onClick={() => setShowSignOut((v) => !v)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = showSignOut ? "rgba(0,108,74,0.05)" : "transparent"; }}
        >
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: "rgba(0,108,74,0.12)", color: "#006c4a" }}
          >
            {initials}
          </div>

          {/* Name + plan */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#1a1f1e" }}>
              {currentUser?.name ?? "Guest"}
            </p>
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "#a8b5af" }}>
              {currentUser?.plan ?? "Free"} Plan
            </p>
          </div>

          {/* Chevron indicator */}
          <span
            className="material-symbols-outlined text-[18px] transition-transform flex-shrink-0"
            style={{ color: "#c4d0cb", transform: showSignOut ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            expand_more
          </span>

          {/* Sign out popover */}
          {showSignOut && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden shadow-lg"
              style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.08)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <p className="text-xs font-bold truncate" style={{ color: "#1a1f1e" }}>{currentUser?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-left transition-all hover:bg-red-50"
                style={{ color: "#ef4444" }}
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
