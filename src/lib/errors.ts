// One place for every error code → user text (PLAN.md Decisions › Copy, ui-build-plan.md §7).

export interface ErrorDetails {
  code: string;
  field?: string;
  index?: number;
  problem?: string;
  message?: string;
}

const TEXT: Record<string, string> = {
  invalid_key: "That key is not valid.",
  session_expired: "Your session ended or the key is no longer valid. Sign in again.",
  project_key_invalid: "Enter this project's API key to manage its addresses.",
  wrong_role: "You don't have access to this page.",
  api_timeout: "The API took too long to answer. Try again.",
  api_unreachable: "The API can't be reached. Check that ton-observer is running.",
  not_found: "Not found.",
  csrf: "The request was blocked. Reload the page and try again.",
  payload_too_large: "That request is too large.",
  admin_disabled: "The admin API is turned off on this server (ADMIN_API_KEY is not set).",
  missing_admin_key: "That key is not valid.",
  invalid_admin_key: "That key is not valid.",
  missing_api_key: "That key is not valid.",
  invalid_api_key: "That key is not valid. It may have been rotated.",
  UNAUTHENTICATED: "That key is not valid. It may have been rotated.",
  project_exists: "A project with this name already exists.",
  project_not_found: "Project not found.",
  invalid_project_id: "That project id is not valid.",
  invalid_address: "That is not a valid TON address.",
  address_not_linked: "This address is no longer linked. The list was refreshed.",
  FORBIDDEN: "This address is not linked to your project.",
  internal_error: "Something went wrong on the server. Try again.",
  INTERNAL_SERVER_ERROR: "Something went wrong on the server. Try again.",
  network: "Something went wrong on the server. Try again.",
};

const FALLBACK = TEXT.internal_error;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function errorText(details: ErrorDetails): string {
  const { code, field, index, problem, message } = details;
  if (code === "invalid_request") {
    if (field === "name" && problem) return `Name ${problem}.`;
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
