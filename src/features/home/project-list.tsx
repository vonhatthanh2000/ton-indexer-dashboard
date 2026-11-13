"use client";

import { FolderPlus, Inbox } from "lucide-react";
import Link from "next/link";
import { Identicon } from "@/components/chain/identicon";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, Card, EmptyState, RolePill } from "@/components/ui";
import { useMe } from "@/features/auth/use-me";
import type { Me } from "@/lib/types";
import { homeView } from "./home-view";

function Empty({ me }: { me: Me }) {
  if (me.user.isAdmin) {
    return (
      <EmptyState
        icon={FolderPlus}
        title="No projects yet"
        body="Create a project and give it an owner. The owner then adds addresses and members."
        action={
          <ButtonLink href="/admin" variant="primary">
            Create the first project
          </ButtonLink>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={Inbox}
      title="No projects yet"
      body={
        <>
          You&apos;re not in any project yet. Ask an admin or a project owner to add{" "}
          <span className="font-medium text-ink">{me.user.email}</span>.
        </>
      }
      action={<ButtonLink href="/account">Go to your account</ButtonLink>}
    />
  );
}

/** `/`: the signed-in user's projects as cards. The page redirects a single-project member first. */
export function ProjectList({ initialMe }: { initialMe: Me }) {
  const me = useMe().data ?? initialMe;
  const view = homeView(me);
  // "redirect" only reaches here when ["me"] changed on the client; the list then has one card.
  const empty = view.kind === "empty-admin" || view.kind === "empty-member";
  return (
    <>
      <PageHeader title="Projects" crumbs={[{ label: "Projects" }]} />
      {empty ? (
        <Card>
          <Empty me={me} />
        </Card>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-label="Your projects">
          {me.projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${encodeURIComponent(project.id)}`}
                className="card card-link flex items-center gap-4"
              >
                <Identicon seed={project.id} size={40} />
                <span className="min-w-0 flex-1 truncate text-card-title font-semibold">{project.name}</span>
                <RolePill role={project.role} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
