import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "@/server/env";

describe("parseEnv", () => {
  it("names the variable, never the value", () => {
    try {
      parseEnv({ SESSION_SECRET: "short-secret-value" });
      throw new Error("expected EnvError");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as Error).message).toContain("SESSION_SECRET");
      expect((error as Error).message).not.toContain("short-secret-value");
    }
  });
  it("defaults the API URL and trims a trailing slash", () => {
    const secret = "x".repeat(32);
    expect(parseEnv({ SESSION_SECRET: secret }).OBSERVER_API_URL).toBe("http://localhost:3000");
    expect(parseEnv({ SESSION_SECRET: secret, OBSERVER_API_URL: "http://api:3000/" }).OBSERVER_API_URL).toBe(
      "http://api:3000",
    );
  });
});
