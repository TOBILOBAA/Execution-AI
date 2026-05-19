/**
 * Session manager — bridges the frontend's auth system with the backend session.
 *
 * When a user signs in or signs up on the frontend, we create (or retrieve)
 * a backend session and store the session_id in localStorage.
 *
 * The local cache is keyed by auth user id, but the backend now also stores an
 * auth_user_id link so the same workspace can be recovered across browsers.
 */

import type { Session } from "./api";

export interface BackendSessionIdentity {
  id: string;
  name?: string;
  email?: string;
}

const SESSION_KEY_PREFIX = "execution-ai-session-";
const pendingSessionRequests = new Map<string, Promise<Session>>();

export function getSessionId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${SESSION_KEY_PREFIX}${userId}`);
}

export function setSessionId(userId: string, sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${SESSION_KEY_PREFIX}${userId}`, sessionId);
}

export function clearSessionId(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${SESSION_KEY_PREFIX}${userId}`);
}

/**
 * Ensure a backend session exists for this user.
 * Creates one if not found, returns the existing one if present.
 */
export async function ensureBackendSession(identity: string | BackendSessionIdentity): Promise<Session> {
  const userId = typeof identity === "string" ? identity : identity.id;
  const inflight = pendingSessionRequests.get(userId);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const { sessionsApi } = await import("./api");
    const existing = getSessionId(userId);
    if (existing) {
      try {
        const session = await sessionsApi.get(existing);
        if (session.auth_user_id === userId) {
          return session;
        }
      } catch {
        clearSessionId(userId);
      }
    }

    // Create or recover a session on the backend for this auth user
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    const session = await sessionsApi.create(timezone, userId);
    setSessionId(userId, session.id);
    return session;
  })();

  pendingSessionRequests.set(userId, request);
  try {
    return await request;
  } finally {
    pendingSessionRequests.delete(userId);
  }
}
