import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { homeView } from "@/features/home/home-view";
import { ProjectList } from "@/features/home/project-list";
import { ApiError } from "@/lib/client";
import type { Me } from "@/lib/types";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Projects" };

export default async function Home() {
  // The same cached call as the layout's. A failure or a lost session is the layout's to show.
  let me: Me | null;
  try {
    me = await getMe();
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
  if (me === null) return null;

  const view = homeView(me);
  if (view.kind === "redirect") redirect(view.href);
  return <ProjectList initialMe={me} />;
}
