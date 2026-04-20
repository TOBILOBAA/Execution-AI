/** True if `id` is a canonical UUID string (matches backend / Supabase ids). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | undefined | null): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}
