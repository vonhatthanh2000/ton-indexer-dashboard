import { callUpstream, passThrough, route } from "@/server/upstream";

export const GET = route({}, async () => passThrough(await callUpstream("GET", "/health/ready", {})));
