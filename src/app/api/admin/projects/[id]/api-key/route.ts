import type { NextRequest } from "next/server";
import { adminCall } from "@/server/admin-calls";
import { readProjectKeys, withProjectKey, writeProjectKeys } from "@/server/session";
import { json, requireProjectId, route } from "@/server/upstream";

type Context = { params: Promise<{ id: string }> };

export const POST = route<Context>({ role: "admin" }, async (request: NextRequest, { params, session }) => {
  const projectId = requireProjectId((await params).id);
  const result = await adminCall(request, session, "POST", `/projects/${projectId}/api-key`);
  if ("response" in result) return result.response;
  const response = json(result.reply.status, result.reply.body);
  const apiKey = (result.reply.body as { apiKey?: unknown } | undefined)?.apiKey;
  if (result.reply.status === 200 && typeof apiKey === "string") {
    const entries = await readProjectKeys(request.cookies);
    await writeProjectKeys(response, request, withProjectKey(entries, projectId, apiKey));
  }
  return response;
});
