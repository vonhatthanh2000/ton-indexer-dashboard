import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import {
  findProjectKey,
  readProjectKeys,
  type SessionData,
  withoutProjectKey,
  writeProjectKeys,
} from "./session";
import {
  type UpstreamReply,
  callUpstream,
  errorReply,
  passThrough,
  sessionExpiredReply,
} from "./upstream";

type Method = "GET" | "POST" | "PUT" | "DELETE";

/** An admin-key call; a 401 means the admin key no longer works, so the session ends. */
export async function adminCall(
  request: NextRequest,
  session: SessionData | undefined,
  method: Method,
  path: string,
  body?: unknown,
): Promise<{ reply: UpstreamReply } | { response: NextResponse }> {
  const reply = await callUpstream(method, path, { "X-Admin-Key": session!.key }, body);
  if (reply.status === 401) return { response: sessionExpiredReply(request) };
  return { reply };
}

/** A project-key call from an admin route, using the key stored for that project. */
export async function projectKeyCall(
  request: NextRequest,
  projectId: string,
  method: Method,
  path: string,
  body?: unknown,
): Promise<NextResponse> {
  const entries = await readProjectKeys(request.cookies);
  const key = findProjectKey(entries, projectId);
  if (key === undefined) return errorReply(401, "project_key_invalid");
  const reply = await callUpstream(method, path, { "X-API-Key": key }, body);
  if (reply.status === 401) {
    const response = errorReply(401, "project_key_invalid");
    await writeProjectKeys(response, request, withoutProjectKey(entries, projectId));
    return response;
  }
  return passThrough(reply);
}
