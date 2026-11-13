// One place for every error code → user text (PLAN.md Decisions › Types and errors).

export interface ErrorDetails {
  code: string;
  field?: string;
  index?: number;
  problem?: string;
  message?: string;
}

const TEXT: Record<string, string> = {
  // From the API.
  invalid_address: "That is not a valid TON address.",
  invalid_project_id: "That project id is not valid.",
  invalid_user_id: "That user id is not valid.",
  not_logged_in: "You're signed out. Sign in again.",
  missing_api_key: "You're signed out. Sign in again.",
  missing_admin_key: "You're signed out. Sign in again.",
  invalid_credentials: "Wrong email or password.",
  insufficient_role: "Your role on this project doesn't allow that.",
  owner_only: "Only a project owner can do that.",
  admin_only: "Only an admin can do that.",
  bad_origin: "This dashboard isn't the configured DASHBOARD_ORIGIN. Ask whoever runs the server.",
  project_not_found: "That project is gone or you're no longer a member.",
  member_not_found: "That member is no longer on this project. The list was refreshed.",
  address_not_linked: "This address is no longer linked. The list was refreshed.",
  last_owner: "A project needs at least one owner. Add another owner first.",
  project_exists: "A project with this name already exists.",
  login_disabled: "Sign-in isn't configured on this server.",
  google_login_disabled: "Sign-in isn't configured on this server.",
  admin_disabled: "Admin features are off on this server.",
  // `login_error` on the return from Google.
  google_cancelled: "Google sign-in was cancelled.",
  not_invited: "No account for this email. Ask an admin to invite you.",
  google_account_mismatch: "This email is linked to a different Google account. Sign in with that one.",
  bad_state: "Google sign-in didn't complete. Try again.",
  google_failed: "Google sign-in didn't complete. Try again.",
  // The dashboard's own.
  not_found: "Not found.",
  payload_too_large: "That request is too large.",
  api_timeout: "The API took too long to answer. Try again.",
  api_unreachable: "The API can't be reached. Check that ton-observer is running.",
  network: "The dashboard can't be reached. Check your connection and try again.",
  internal_error: "Something went wrong on the server. Try again.",
  // GraphQL.
  UNAUTHENTICATED: "You're signed out. Sign in again.",
  FORBIDDEN: "This address is not linked to your project.",
  INTERNAL_SERVER_ERROR: "Something went wrong on the server. Try again.",
};

// Distinct from internal_error, so a code without text shows up in the errors table test.
const FALLBACK = "Something unexpected went wrong. Try again.";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function errorText(details: ErrorDetails): string {
  const { code, field, index, problem, message } = details;
  if (code === "invalid_request") {
    if (field === "name" && problem) return `Name ${problem}.`;
    if (field === "ownerEmail" && problem) return `Owner email ${problem}.`;
    if (field === "addresses" && problem) {
      return index === undefined ? `Addresses ${problem}.` : `Line ${index + 1} ${problem}.`;
    }
    if (field && problem) return `${capitalize(field)} ${problem}.`;
    return "The request is not valid.";
  }
  // The server's message names the argument, never a value.
  if (code === "BAD_USER_INPUT") return message ? capitalize(message) : "The request is not valid.";
  return TEXT[code] ?? FALLBACK;
}
