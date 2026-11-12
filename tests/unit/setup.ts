import { vi } from "vitest";

// `server-only` throws outside a React Server environment; unit tests import server modules directly.
vi.mock("server-only", () => ({}));
process.env.SESSION_SECRET ??= "unit-test-secret-unit-test-secret-0123456789";
process.env.OBSERVER_API_URL ??= "http://127.0.0.1:3999";
