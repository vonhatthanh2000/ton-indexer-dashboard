// Starts `next dev|start` on $PORT (default 3100), bound to 127.0.0.1.
// Next reads PORT only from the shell, never from .env files, so the package scripts load
// .env and .env.local into the environment first (node --env-file-if-exists; .env.local wins).
import { spawn } from "node:child_process";

const DEFAULT_PORT = 3100;
const HOST = "127.0.0.1"; // local only: the session cookie has no Secure flag over plain http

const command = process.argv[2];
if (command !== "dev" && command !== "start") {
  console.error("usage: node scripts/next.mjs dev|start");
  process.exit(2);
}

const raw = process.env.PORT?.trim() || String(DEFAULT_PORT);
const port = Number(raw);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Invalid environment: PORT (must be a whole number from 1 to 65535)");
  process.exit(1);
}

const child = spawn("next", [command, "-H", HOST, "-p", String(port), ...process.argv.slice(3)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
