import { forward } from "@/server/forward";

export function GET(request: Request) {
  return forward(request, "/health/ready");
}
