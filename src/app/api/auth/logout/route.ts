import type { NextRequest } from "next/server";
import { clearSessionCookies } from "@/server/session";
import { json, route } from "@/server/upstream";

export const POST = route({}, async (request: NextRequest) => {
  const response = json(204, undefined);
  clearSessionCookies(response, request);
  return response;
});
