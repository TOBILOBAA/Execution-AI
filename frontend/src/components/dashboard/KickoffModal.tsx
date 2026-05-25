"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getToday } from "@/lib/mockData";
import {
  AddToHomeScreenSheet,
  type AddToHomeScreenVariant,
} from "./AddToHomeScreenSheet";
import { DailyKickoffModal } from "./DailyKickoffModal";

/** Canonical kickoff state-machine entrypoint for the home funnel. */
const A2HS_ACKNOWLEDGED_KEY = "execution-ai:add-to-home-screen:acknowledged";
const A2HS_SNOOZE_UNTIL_KEY = "execution-ai:add-to-home-screen:snooze-until";
const A2HS_SNOOZE_MS = 1000 * 60 * 60 * 24 * 7;

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
  );
}

function getAddToHomeScreenVariant(): AddToHomeScreenVariant | null {
  if (typeof window === "undefined") return null;
  if (!window.matchMedia("(max-width: 767px)").matches) return null;
  if (isStandaloneMode()) return null;
  if (localStorage.getItem(A2HS_ACKNOWLEDGED_KEY) === "1") return null;

  const snoozedUntil = Number(localStorage.getItem(A2HS_SNOOZE_UNTIL_KEY) ?? "0");
  if (Number.isFinite(snoozedUntil) && snoozedUntil > Date.now()) return null;

  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isAndroid) return "android";
  if (!isIOS) return null;

  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isSafari ? "ios-safari" : "ios-browser";
}

export function KickoffModal() {
  const dailyPriorities = useAppStore((s) => s.dailyPriorities);
  const secondaryTasks = useAppStore((s) => s.secondaryTasks);
  const habits = useAppStore((s) => s.habits);
  const kickoffPending = useAppStore((s) => s.kickoffPending);
  const dismissKickoff = useAppStore((s) => s.dismissKickoff);
  const [installSheetVariant, setInstallSheetVariant] =
    useState<AddToHomeScreenVariant | null>(null);
  const [showInstallSheet, setShowInstallSheet] = useState(false);
  const installSheetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setInstallSheetVariant(getAddToHomeScreenVariant());
    return () => {
      if (installSheetTimerRef.current !== null) {
        window.clearTimeout(installSheetTimerRef.current);
      }
    };
  }, []);

  const todayPriorities = dailyPriorities.filter((p) => p.date === getToday());
  const todayTasks = secondaryTasks.filter((t) => t.date === getToday());

  const handleBegin = () => {
    const variant = getAddToHomeScreenVariant();
    dismissKickoff();

    if (!variant) return;
    setInstallSheetVariant(variant);
    if (installSheetTimerRef.current !== null) {
      window.clearTimeout(installSheetTimerRef.current);
    }
    installSheetTimerRef.current = window.setTimeout(() => {
      setShowInstallSheet(true);
    }, 180);
  };

  const handleAcknowledge = () => {
    if (installSheetTimerRef.current !== null) {
      window.clearTimeout(installSheetTimerRef.current);
      installSheetTimerRef.current = null;
    }
    localStorage.setItem(A2HS_ACKNOWLEDGED_KEY, "1");
    localStorage.removeItem(A2HS_SNOOZE_UNTIL_KEY);
    setShowInstallSheet(false);
    setInstallSheetVariant(null);
  };

  const handleDismiss = () => {
    if (installSheetTimerRef.current !== null) {
      window.clearTimeout(installSheetTimerRef.current);
      installSheetTimerRef.current = null;
    }
    localStorage.setItem(
      A2HS_SNOOZE_UNTIL_KEY,
      String(Date.now() + A2HS_SNOOZE_MS),
    );
    setShowInstallSheet(false);
  };

  if (!kickoffPending && !showInstallSheet) return null;

  return (
    <>
      {kickoffPending ? (
        <DailyKickoffModal
          priorities={todayPriorities}
          tasks={todayTasks}
          habits={habits}
          onBegin={handleBegin}
        />
      ) : null}
      {showInstallSheet && installSheetVariant ? (
        <AddToHomeScreenSheet
          variant={installSheetVariant}
          onAcknowledge={handleAcknowledge}
          onDismiss={handleDismiss}
        />
      ) : null}
    </>
  );
}
