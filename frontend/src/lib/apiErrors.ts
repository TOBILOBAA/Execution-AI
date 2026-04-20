import { ApiError } from "./api";

/** Human-readable message for failed API / network calls (for UI banners). */
export function formatApiError(context: string, error: unknown): string {
  let detail = "Request failed";
  if (error instanceof ApiError) {
    detail = error.message || detail;
  } else if (error instanceof Error) {
    detail = error.message || detail;
  }
  return `${context}: ${detail}`;
}
