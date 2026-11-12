import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectAddressesPage } from "@/features/admin/project-addresses";

export const metadata: Metadata = { title: "Project addresses" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ProjectAddressesPage projectId={id} />
    </Suspense>
  );
}
