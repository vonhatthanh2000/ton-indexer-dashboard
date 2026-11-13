import { z } from "zod";

const envSchema = z.object({
  OBSERVER_API_URL: z.url().default("http://localhost:3000"),
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
      console.error(`${error.message} (OBSERVER_API_URL must be an http(s) URL)`);
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
