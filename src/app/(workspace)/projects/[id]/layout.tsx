import { ProjectScope } from "@/features/project/scope";

// The membership check and the role come from the client ["me"] query (seeded by the workspace
// layout), so a role change after a mutation shows without a reload.
export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[id]">) {
  const { id } = await params;
  return <ProjectScope projectId={id}>{children}</ProjectScope>;
}
