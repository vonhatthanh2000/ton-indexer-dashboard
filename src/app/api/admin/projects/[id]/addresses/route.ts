import type { NextRequest } from "next/server";
import { projectKeyCall } from "@/server/admin-calls";
import { ProxyError, readJsonBody, requireProjectId, route } from "@/server/upstream";

type Context = { params: Promise<{ id: string }> };

const DIGITS = /^[0-9]{1,16}$/;

export const GET = route<Context>({ role: "admin" }, async (request: NextRequest, { params }) => {
  const projectId = requireProjectId((await params).id);
  const query = new URLSearchParams();
  for (const name of ["limit", "offset"]) {
    const value = request.nextUrl.searchParams.get(name);
    if (value === null) continue;
    if (!DIGITS.test(value)) throw new ProxyError(400, "invalid_request");
    query.set(name, value);
  }
  const suffix = query.size > 0 ? `?${query}` : "";
  return projectKeyCall(request, projectId, "GET", `/projects/${projectId}/addresses${suffix}`);
});

export const POST = route<Context>({ role: "admin" }, async (request: NextRequest, { params }) => {
  const projectId = requireProjectId((await params).id);
  const body = await readJsonBody(request);
  return projectKeyCall(request, projectId, "POST", `/projects/${projectId}/addresses`, body);
});
