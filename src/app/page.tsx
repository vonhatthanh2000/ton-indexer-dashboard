import { redirect } from "next/navigation";
import { getPageSession } from "@/server/page-session";

// src/proxy.ts redirects first; this covers a request that reaches the page anyway.
export default async function Home() {
  const session = await getPageSession();
  redirect(session ? (session.role === "admin" ? "/admin" : "/project") : "/login");
}
