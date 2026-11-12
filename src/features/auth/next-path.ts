/** `next` is honoured only for same-origin workspace paths. */
export function safeNextPath(value: string | null | undefined, role: "admin" | "project"): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const prefix = role === "admin" ? "/admin" : "/project";
  if (value !== prefix && !value.startsWith(`${prefix}/`) && !value.startsWith(`${prefix}?`)) return null;
  return value;
}
