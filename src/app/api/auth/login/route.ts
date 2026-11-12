import type { NextRequest } from "next/server";
import { clearProjectKeysCookie, setSessionCookie, type Role } from "@/server/session";
import {
  ProxyError,
  callUpstream,
  errorReply,
  isValidKey,
  json,
  readJsonBody,
  requireObject,
  route,
} from "@/server/upstream";

const PROJECT_QUERY = "query DashboardSignIn { project { id name } }";

interface GraphqlReply {
  data?: { project?: { id?: unknown; name?: unknown } | null } | null;
  errors?: { extensions?: { code?: unknown } }[];
}

export const POST = route({}, async (request: NextRequest) => {
  const body = requireObject(await readJsonBody(request));
  const role = body.role;
  if (role !== "admin" && role !== "project") throw new ProxyError(400, "invalid_request");
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!isValidKey(role, key)) return errorReply(401, "invalid_key");

  const identity = role === "admin" ? await checkAdminKey(key) : await checkProjectKey(key);
  if ("error" in identity) return errorReply(identity.status, identity.error);

  const response = json(200, { role, ...identity.project });
  clearProjectKeysCookie(response, request);
  await setSessionCookie(response, request, {
    role: role as Role,
    key,
    projectId: identity.project?.projectId,
    projectName: identity.project?.projectName,
    issuedAt: Date.now(),
  });
  return response;
});

type Identity =
  | { project?: { projectId: string; projectName: string } }
  | { status: number; error: string };

async function checkAdminKey(key: string): Promise<Identity> {
  const reply = await callUpstream("GET", "/projects", { "X-Admin-Key": key });
  if (reply.status === 200) return {};
  if (reply.status === 401) return { status: 401, error: "invalid_key" };
  const code = (reply.body as { error?: unknown } | undefined)?.error;
  if (reply.status === 503 && code === "admin_disabled") return { status: 503, error: code };
  return { status: 502, error: "api_unreachable" };
}

async function checkProjectKey(key: string): Promise<Identity> {
  const reply = await callUpstream(
    "POST",
    "/graphql",
    { "X-API-Key": key },
    { query: PROJECT_QUERY },
  );
  const body = reply.body as GraphqlReply | undefined;
  const codes = body?.errors?.map((error) => error.extensions?.code) ?? [];
  if (codes.includes("UNAUTHENTICATED")) return { status: 401, error: "invalid_key" };
  const project = body?.data?.project;
  if (reply.status === 200 && typeof project?.id === "string" && typeof project.name === "string") {
    return { project: { projectId: project.id, projectName: project.name } };
  }
  return { status: 502, error: "api_unreachable" };
}
