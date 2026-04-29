"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatWeekPreference, getTodayLabel, getGreeting } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";

const PAGE_TITLES: Record<string, { title: string; label: string }> = {
  "/dashboard": { title: "", label: "Today" },
  "/dashboard/goals": { title: "Strategy Dashboard", label: "Strategic Flow" },
  "/dashboard/reports": { title: "Performance Analytics", label: "Historical Archive" },
};

export function TopBar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { currentUser, signOut } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      signOut: state.signOut,
    })),
  );
  const weekStartsOn = useAppStore((state) => state.sessionWeekStartsOn);
  const setWeekStartsOn = useAppStore((state) => state.setWeekStartsOn);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const page = PAGE_TITLES[pathname] ?? { title: "", label: "" };
  const isHome = pathname === "/dashboard";
  const firstName = currentUser?.name?.split(" ")[0] ?? "there";
  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace("/auth");
  };

  return (
    <header className="w-full sticky top-0 z-20 bg-white px-6 md:px-8 py-4 flex items-center justify-between">
      <div className="flex flex-col">
        {isHome ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>
              {getTodayLabel()}
            </span>
            <h2 className="font-headline font-bold text-[22px] leading-tight tracking-tight" style={{ color: "#1a1f1e" }}>
              {getGreeting()}, {firstName}
            </h2>
          </>
        ) : (
          <>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[--color-on-surface-variant]/70">
              {page.label}
            </span>
            <h2 className="font-headline font-bold text-lg text-[--color-on-surface] tracking-tight">{page.title}</h2>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative w-9 h-9 flex items-center justify-center rounded-full transition-colors"
          style={{ color: "#8a9e97" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#f4f6f4")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
            style={{ background: "#006c4a" }}
          />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer transition-opacity hover:opacity-80 outline-none"
            style={{ background: "rgba(0,108,74,0.12)", color: "#006c4a" }}
            title={currentUser?.name ?? "Account"}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            {initials}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-52 py-1 rounded-2xl shadow-lg border z-30 bg-white"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <p className="text-xs font-bold truncate" style={{ color: "#1a1f1e" }}>
                  {currentUser?.name ?? "Guest"}
                </p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: "#8a9e97" }}>
                  {currentUser?.email ?? ""}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => void setWeekStartsOn(weekStartsOn === "sunday" ? "monday" : "sunday")}
                className="w-full flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5 text-left text-xs font-bold transition-colors hover:bg-[#f4f6f4]"
                style={{ color: "#1a1f1e" }}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: "#6b7c75" }}>
                    calendar_month
                  </span>
                  Week starts on
                </span>
                <span style={{ color: "#6b7c75" }}>
                  {weekStartsOn === "sunday" ? "Sun" : "Mon"}
                </span>
              </button>
              <div className="px-3 pb-2 text-[10px]" style={{ color: "#8a9e97" }}>
                {formatWeekPreference(weekStartsOn)}
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleSignOut()}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold transition-colors hover:bg-[#f4f6f4]"
                style={{ color: "#1a1f1e" }}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#6b7c75" }}>
                  logout
                </span>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
