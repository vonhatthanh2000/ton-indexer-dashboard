import { describe, expect, it } from "vitest";
import { errorText } from "@/lib/errors";

describe("errorText", () => {
  it("maps known codes", () => {
    expect(errorText({ code: "invalid_key" })).toBe("That key is not valid.");
    expect(errorText({ code: "project_exists" })).toBe("A project with this name already exists.");
  });
  it("names the field problem", () => {
    expect(errorText({ code: "invalid_request", field: "name", problem: "is required" })).toBe(
      "Name is required.",
    );
    expect(
      errorText({ code: "invalid_request", field: "addresses", index: 2, problem: "is a duplicate" }),
    ).toBe("Line 3 is a duplicate.");
  });
  it("falls back for unknown codes", () => {
    expect(errorText({ code: "weird" })).toBe("Something went wrong on the server. Try again.");
  });
});
