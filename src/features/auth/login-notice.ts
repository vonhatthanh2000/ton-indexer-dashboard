import { errorText } from "@/lib/errors";

export interface LoginNotice {
  tone: "warn" | "err";
  text: string;
}

export const EXPIRED_TEXT = "Your session ended. Sign in again.";

/**
 * The message `/login` shows for its query (PLAN.md Decisions › Sign-in page): `?error=<code>`
 * (a failed Google return, sent on by src/proxy.ts) wins over `?reason=expired`.
 */
export function loginNotice(reason: string | null | undefined, error: string | null | undefined): LoginNotice | null {
  if (error) return { tone: "err", text: errorText({ code: error }) };
  if (reason === "expired") return { tone: "warn", text: EXPIRED_TEXT };
  return null;
}

