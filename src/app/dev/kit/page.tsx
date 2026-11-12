import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Kit } from "./kit";

export const metadata: Metadata = { title: "Component kit" };

// Development only: every component state on one page.
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Kit />;
}
