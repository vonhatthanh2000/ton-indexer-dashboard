import { forwardApi } from "@/server/forward";

// `/api/graphql`, `/api/users` and `/api/projects[/…]` go to ton-observer; anything else is 404.
// `/api/health` has its own route (a static segment wins over this catch-all).
export const GET = forwardApi;
export const POST = forwardApi;
export const PUT = forwardApi;
export const DELETE = forwardApi;
