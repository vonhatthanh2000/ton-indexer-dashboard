import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "@/server/env";

describe("parseEnv", () => {
  it("needs no secret: an empty environment is valid", () => {
    expect(parseEnv({})).toEqual({ OBSERVER_API_URL: "http://localhost:3000" });
  });
  it("names the variable, never the value", () => {
    try {
      parseEnv({ OBSERVER_API_URL: "not a url secret-value" });
      throw new Error("expected EnvError");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as Error).message).toContain("OBSERVER_API_URL");
      expect((error as Error).message).not.toContain("secret-value");
    }
  });
  it("trims a trailing slash from the API URL", () => {
    expect(parseEnv({ OBSERVER_API_URL: "http://api:3000/" }).OBSERVER_API_URL).toBe("http://api:3000");
  });
});
