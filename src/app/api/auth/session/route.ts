import type { NextRequest } from "next/server";
import { readSession } from "@/server/session";
import { json, sessionExpiredReply } from "@/server/upstream";

// Never returns the key.
export async function GET(request: NextRequest) {
  const state = await readSession(request.cookies);
  if (state.kind === "none") return json(401, { error: "session_expired" });
  if (state.kind === "expired") return sessionExpiredReply(request);
  const { role, projectId, projectName } = state.session;
  return json(200, { role, projectId, projectName });
}
