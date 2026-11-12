import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { assertEnv } from "./src/server/env";

// The env check runs for dev and start; `next build` needs no secret.
export default function config(phase: string): NextConfig {
  if (phase !== PHASE_PRODUCTION_BUILD) assertEnv(process.env);
  return {
    poweredByHeader: false,
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
}
