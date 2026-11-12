import { z } from "zod";

const envSchema = z.object({
  OBSERVER_API_URL: z.url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(readonly variables: string[]) {
    super(`Invalid environment: ${variables.join(", ")}`);
    this.name = "EnvError";
  }
}

// Names the variable only; values are never printed.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new EnvError(names);
  }
  return { ...parsed.data, OBSERVER_API_URL: parsed.data.OBSERVER_API_URL.replace(/\/+$/, "") };
}

export function assertEnv(source: Record<string, string | undefined>): void {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) {
      const hint = error.variables.includes("SESSION_SECRET") ? " (SESSION_SECRET needs at least 32 characters)" : "";
      console.error(`${error.message}${hint}`);
      process.exit(1);
    }
    throw error;
  }
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
