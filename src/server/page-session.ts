import "server-only";
import { cookies } from "next/headers";
import type { SessionInfo } from "@/lib/types";
import { readSession } from "./session";

/** For server layouts: role and project name only, never the key. */
export async function getPageSession(): Promise<SessionInfo | null> {
  const state = await readSession(await cookies());
  if (state.kind !== "valid") return null;
  const { role, projectId, projectName } = state.session;
  return { role, projectId, projectName };
}
