import { ApiError } from "./api";

/** Human-readable message for failed API / network calls (for UI banners). */
export function formatApiError(context: string, error: unknown): string {
  let detail = "Request failed";
  if (error instanceof ApiError) {
    detail = error.message || detail;
  } else if (error instanceof Error) {
    detail = error.message || detail;
  }
  if (typeof console !== "undefined") {
    console.error(`[sync error] ${context}`, error);
  }
  return `${context}: ${detail}`;
}

export interface UserFacingSyncError {
  title: string;
  message: string;
  footer: string;
}

function splitSyncError(syncError: string): { context: string; detail: string } {
  const separator = syncError.indexOf(": ");
  if (separator === -1) {
    return { context: "", detail: syncError.trim() };
  }
  return {
    context: syncError.slice(0, separator).trim(),
    detail: syncError.slice(separator + 2).trim(),
  };
}

function isNetworkDetail(detail: string): boolean {
  return /failed to fetch|network|load failed|could not fetch|couldn't reach|server didn't respond/i.test(detail);
}

function isTimeoutDetail(detail: string): boolean {
  return /timed out|too long to respond/i.test(detail);
}

export function describeSyncError(syncError: string): UserFacingSyncError {
  const { context, detail } = splitSyncError(syncError);
  const lowerContext = context.toLowerCase();

  if (/available after 18:00 utc/i.test(detail)) {
    return {
      title: "Report not ready yet",
      message: "Today's report will be ready after 18:00 UTC.",
      footer: "Come back later today and try again.",
    };
  }

  const mainGoalLimit = detail.match(/You can only save up to (\d+) main goals? for this (day|week|month)/i);
  if (mainGoalLimit) {
    const [, count, period] = mainGoalLimit;
    return {
      title: "You've hit the limit",
      message: `You already have ${count} main goals for this ${period}. Remove one before adding another.`,
      footer: "Nothing else changed.",
    };
  }

  if (/this period is locked/i.test(detail)) {
    return {
      title: "This period is locked",
      message: "You can review it, but you can't edit it now.",
      footer: "Only the current period stays editable.",
    };
  }

  if (/backend session is not ready|session is active|sign in or refresh/i.test(detail)) {
    return {
      title: "Session needs a refresh",
      message: "Your session needs to reconnect before this can continue.",
      footer: "Refresh this page, then try again.",
    };
  }

  if (/http 409|conflict|already exists|duplicate/i.test(detail)) {
    return {
      title: "This is out of sync",
      message: "The server already has a conflicting version of this change.",
      footer: "Refresh the page, then try again.",
    };
  }

  if (/still syncing|still saving|wait a moment and try again/i.test(detail)) {
    return {
      title: "Still finishing your last change",
      message: "The previous step is still saving to the server.",
      footer: "Wait a moment, then try again.",
    };
  }

  if (isTimeoutDetail(detail)) {
    return {
      title: lowerContext.startsWith("load ") ? "This is taking too long" : "Couldn't finish that yet",
      message: "The server took too long to respond.",
      footer: "Try again. If it keeps happening, contact support.",
    };
  }

  if (isNetworkDetail(detail)) {
    return {
      title: lowerContext.startsWith("load ") ? "Couldn't load this" : "Couldn't save your changes",
      message: "Couldn't reach the server.",
      footer: "Check your connection and try again.",
    };
  }

  if (/couldn.t generate|didn.t return suggestions|ai/i.test(detail) && lowerContext.includes("generate")) {
    return {
      title: "Couldn't generate with AI",
      message: "AI couldn't finish this right now.",
      footer: "Try again, or set it up manually.",
    };
  }

  if (/title/i.test(detail) && /save/i.test(lowerContext)) {
    return {
      title: "Goal needs a title",
      message: "Add a title before you save this goal.",
      footer: "Then try again.",
    };
  }

  if (lowerContext.startsWith("load ")) {
    return {
      title: "Couldn't load this",
      message: "Something broke while we were getting this ready.",
      footer: "Try again. If it keeps happening, contact support.",
    };
  }

  const canShowDetail = detail.length > 0 && detail !== "Request failed" && !/^HTTP \d+$/i.test(detail);

  return {
    title: "Couldn't save your changes",
    message: canShowDetail ? detail : "Something unexpected happened.",
    footer: canShowDetail ? "Check this step and try again." : "Try again. If it keeps happening, contact support.",
  };
}
