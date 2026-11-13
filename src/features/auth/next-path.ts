// Pages `next` may return to after sign-in: the workspace, never /login or another origin.
const EXACT = ["/", "/admin", "/account"];
const PREFIXES = ["/projects/", "/admin/"];

/** `value` when it is a same-origin workspace path, else `null`. The Google return always lands on `/`. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (EXACT.some((path) => value === path || value.startsWith(`${path}?`))) return value;
  if (PREFIXES.some((prefix) => value.startsWith(prefix) && value.length > prefix.length)) return value;
  return null;
}
