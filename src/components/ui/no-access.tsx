import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "./empty-state";

/** A page the signed-in user can't open: a project they're not in, or an admin page. */
export function NoAccess({
  title = "No access",
  body = "You're not a member of this project. Ask a project owner to add you.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="grid place-items-center py-12">
      <div className="card w-full max-w-md">
        <EmptyState
          icon={ShieldOff}
          title={title}
          body={body}
          action={
            <Link href="/" className="btn btn-primary">
              Go to my projects
            </Link>
          }
        />
      </div>
    </div>
  );
}
