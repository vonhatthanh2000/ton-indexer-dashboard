import type { NextRequest } from "next/server";
import {
  ProxyError,
  callUpstream,
  passThrough,
  readJsonBody,
  requireObject,
  route,
  sessionExpiredReply,
} from "@/server/upstream";

interface GraphqlBody {
  errors?: { extensions?: { code?: unknown } }[];
}

export const POST = route({ role: "project" }, async (request: NextRequest, { session }) => {
  const body = requireObject(await readJsonBody(request));
  if (typeof body.query !== "string") throw new ProxyError(400, "invalid_request");
  const forwarded = {
    query: body.query,
    ...(body.variables === undefined ? {} : { variables: body.variables }),
    ...(typeof body.operationName === "string" ? { operationName: body.operationName } : {}),
  };
  const reply = await callUpstream("POST", "/graphql", { "X-API-Key": session!.key }, forwarded);
  const errors = (reply.body as GraphqlBody | undefined)?.errors ?? [];
  if (errors.some((error) => error.extensions?.code === "UNAUTHENTICATED")) {
    return sessionExpiredReply(request);
  }
  return passThrough(reply);
});
