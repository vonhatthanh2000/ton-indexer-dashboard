// The only client-side check on a new password (PLAN.md Decisions › /account): 12–256 code points.
// The API has the final say.
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

/** Length in code points, so an emoji counts once (`[...value].length`). */
export function passwordLength(value: string): number {
  return [...value].length;
}

/** The problem with a new password, or `null` when it may be sent. */
export function newPasswordProblem(value: string): string | null {
  const length = passwordLength(value);
  if (length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}

/** The `POST /auth/password` body: `currentPassword` only once the user has a password. */
export function passwordBody(
  hasPassword: boolean,
  currentPassword: string,
  newPassword: string,
): { newPassword: string } | { currentPassword: string; newPassword: string } {
  return hasPassword ? { currentPassword, newPassword } : { newPassword };
}
