import { forwardAuth } from "@/server/forward";

// `/auth/*` must sit at the root: the API sets Google's state cookie with `Path=/auth/google`.
export const GET = forwardAuth;
export const POST = forwardAuth;
export const PUT = forwardAuth;
export const DELETE = forwardAuth;
