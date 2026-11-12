import type { NextRequest } from "next/server";
import { isTonAddress, toRaw } from "@/lib/ton";
import { projectKeyCall } from "@/server/admin-calls";
import { ProxyError, requireProjectId, route } from "@/server/upstream";

type Context = { params: Promise<{ id: string; address: string }> };

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export const DELETE = route<Context>({ role: "admin" }, async (request: NextRequest, { params }) => {
  const { id, address } = await params;
  const projectId = requireProjectId(id);
  const decoded = decodeParam(address);
  if (!isTonAddress(decoded)) throw new ProxyError(400, "invalid_address");
  const raw = encodeURIComponent(toRaw(decoded));
  return projectKeyCall(request, projectId, "DELETE", `/projects/${projectId}/addresses/${raw}`);
});
