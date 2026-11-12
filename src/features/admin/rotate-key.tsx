"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Dialog } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { ApiKeyModal } from "./api-key-modal";
import { useRotateKey } from "./hooks";

/** Confirm, rotate, then show the new key once (spec §4.4). */
export function RotateKeyFlow({
  project,
  onClose,
}: {
  project: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const rotate = useRotateKey();
  const [error, setError] = useState<string | null>(null);

  function close() {
    rotate.reset();
    setError(null);
    onClose();
  }

  if (!project) return null;

  if (rotate.data) {
    return (
      <ApiKeyModal
        open
        projectName={rotate.data.project.name}
        apiKey={rotate.data.apiKey}
        onRegister={() => {
          const id = rotate.data.project.id;
          close();
          router.push(`/admin/projects/${id}?register=1`);
        }}
        onDone={() => {
          close();
          toast.success(`New API key issued for ${project.name}.`);
        }}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : close())}
      title="Rotate API key?"
      description={
        <>
          The current key of <strong className="text-ink">{project.name}</strong> stops working immediately. Anyone
          signed in with it is signed out.
        </>
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="danger"
            busy={rotate.isPending}
            onClick={() =>
              rotate.mutate(project.id, {
                onError: (caught) => setError(errorText({ code: errorCode(caught) })),
              })
            }
          >
            {rotate.isPending ? "Rotating…" : "Rotate API key"}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
