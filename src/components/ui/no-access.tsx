import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "./empty-state";

export function NoAccess() {
  return (
    <main id="main" className="grid min-h-screen place-items-center p-6">
      <div className="card w-full max-w-md">
        <EmptyState
          icon={ShieldOff}
          title="No access"
          body="This workspace belongs to another role. Sign in with the right key to open it."
          action={
            <Link href="/" className="btn btn-primary">
              Go to my workspace
            </Link>
          }
        />
      </div>
    </main>
  );
}
