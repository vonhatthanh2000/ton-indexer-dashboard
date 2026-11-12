import type { NextRequest } from "next/server";
import { adminCall } from "@/server/admin-calls";
import { readProjectKeys, withProjectKey, writeProjectKeys } from "@/server/session";
import { json, passThrough, readJsonBody, route } from "@/server/upstream";

export const GET = route({ role: "admin" }, async (request: NextRequest, { session }) => {
  const result = await adminCall(request, session, "GET", "/projects");
  return "response" in result ? result.response : passThrough(result.reply);
});

interface CreatedReply {
  project?: { id?: unknown };
  apiKey?: unknown;
}

export const POST = route({ role: "admin" }, async (request: NextRequest, { session }) => {
  const body = await readJsonBody(request);
  const result = await adminCall(request, session, "POST", "/projects", body);
  if ("response" in result) return result.response;
  const response = json(result.reply.status, result.reply.body);
  const created = result.reply.body as CreatedReply | undefined;
  if (
    result.reply.status === 201 &&
    typeof created?.project?.id === "string" &&
    typeof created.apiKey === "string"
  ) {
    const entries = await readProjectKeys(request.cookies);
    await writeProjectKeys(response, request, withProjectKey(entries, created.project.id, created.apiKey));
  }
  return response;
});
