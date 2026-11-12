import { errorReply } from "@/server/upstream";

function notFound() {
  return errorReply(404, "not_found");
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
