import { describe, expect, it } from "vitest";
import { errorText } from "@/lib/errors";

// Every code under PLAN.md Decisions › Types and errors.
const CODES = [
  // API
  "invalid_address", "invalid_project_id", "invalid_user_id", "not_logged_in", "missing_api_key",
  "missing_admin_key", "invalid_credentials", "insufficient_role", "owner_only", "admin_only", "bad_origin",
  "project_not_found", "member_not_found", "address_not_linked", "last_owner", "project_exists",
  "login_disabled", "google_login_disabled", "admin_disabled",
  // login_error
  "google_cancelled", "not_invited", "google_account_mismatch", "bad_state", "google_failed",
  // dashboard
  "not_found", "payload_too_large", "api_timeout", "api_unreachable", "network", "internal_error",
  // GraphQL
  "UNAUTHENTICATED", "FORBIDDEN", "INTERNAL_SERVER_ERROR",
];

const FALLBACK = errorText({ code: "no_such_code" });

describe("errorText", () => {
  it.each(CODES)("%s has its own text", (code) => {
    const text = errorText({ code });
    expect(text).not.toBe(FALLBACK);
    expect(text.length).toBeGreaterThan(0);
  });
  it("invalid_request and BAD_USER_INPUT have their own text too", () => {
    expect(errorText({ code: "invalid_request" })).toBe("The request is not valid.");
    expect(errorText({ code: "BAD_USER_INPUT", message: "limit: must be at most 100" })).toBe("Limit: must be at most 100");
  });
  it("uses the specific wording", () => {
    expect(errorText({ code: "bad_origin" })).toBe(
      "This dashboard isn't the configured DASHBOARD_ORIGIN. Ask whoever runs the server.",
    );
    expect(errorText({ code: "admin_disabled" })).toBe("Admin features are off on this server.");
    expect(errorText({ code: "not_invited" })).toBe("No account for this email. Ask an admin to invite you.");
    expect(errorText({ code: "invalid_credentials" })).toBe("Wrong email or password.");
    expect(errorText({ code: "login_disabled" })).toBe("Sign-in isn't configured on this server.");
  });
  it("drops the key-era codes", () => {
    for (const code of ["invalid_key", "session_expired", "project_key_invalid", "wrong_role", "csrf", "invalid_admin_key", "invalid_api_key"]) {
      expect(errorText({ code })).toBe(FALLBACK);
    }
  });
  it("names the field problem", () => {
    expect(errorText({ code: "invalid_request", field: "name", problem: "is required" })).toBe("Name is required.");
    expect(errorText({ code: "invalid_request", field: "ownerEmail", problem: "is required" })).toBe("Owner email is required.");
    expect(errorText({ code: "invalid_request", field: "addresses", index: 2, problem: "is a duplicate" })).toBe(
      "Line 3 is a duplicate.",
    );
    expect(errorText({ code: "invalid_request", field: "newPassword", problem: "is too short" })).toBe(
      "NewPassword is too short.",
    );
  });
});
