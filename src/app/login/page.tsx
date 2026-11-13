import type { Metadata } from "next";
import { Login } from "@/features/auth/login";

export const metadata: Metadata = { title: "Sign in" };

function first(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

// src/proxy.ts already sent signed-in visitors to `/` (unless there is a message to show).
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  return <Login reason={first(query.reason)} error={first(query.error)} next={first(query.next)} />;
}
