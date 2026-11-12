import type { NextRequest } from "next/server";
import { readProjectKeys, withProjectKey, writeProjectKeys } from "@/server/session";
import {
  callUpstream,
  errorReply,
  isValidProjectKey,
  json,
  passThrough,
  readJsonBody,
  requireObject,
  requireProjectId,
  route,
} from "@/server/upstream";

type Context = { params: Promise<{ id: string }> };

// Checks a pasted project key with a one-row address read, then stores it.
export const PUT = route<Context>({ role: "admin" }, async (request: NextRequest, { params }) => {
  const projectId = requireProjectId((await params).id);
  const body = requireObject(await readJsonBody(request));
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!isValidProjectKey(key)) return errorReply(401, "invalid_key");
  const reply = await callUpstream("GET", `/projects/${projectId}/addresses?limit=1`, {
    "X-API-Key": key,
  });
  if (reply.status === 401) return errorReply(401, "invalid_key");
  if (reply.status !== 200) return passThrough(reply);
  const response = json(204, undefined);
  const entries = await readProjectKeys(request.cookies);
  await writeProjectKeys(response, request, withProjectKey(entries, projectId, key));
  return response;
});
