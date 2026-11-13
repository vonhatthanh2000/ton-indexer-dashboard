"use client";

import { CloudOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { errorText } from "@/lib/errors";

/**
 * The workspace when the API is down or sign-in is off: the code's text and a Retry. It never
 * sends anyone to /login, so an API blip doesn't sign people out.
 */
export function WorkspaceError({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const router = useRouter();
  return (
    <div className="grid place-items-center py-12">
      <div className="card w-full max-w-md" role="alert">
        <EmptyState
          icon={CloudOff}
          title="The dashboard can't load right now"
          body={errorText({ code })}
          action={
            <button type="button" className="btn btn-primary" onClick={onRetry ?? (() => router.refresh())}>
              Retry
            </button>
          }
        />
      </div>
    </div>
  );
}
