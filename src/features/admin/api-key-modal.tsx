"use client";

import { TriangleAlert } from "lucide-react";
import { Button, Dialog, MonoBox } from "@/components/ui";

/** Shows a one-time key. Closes only through its buttons, so the key is not lost by a stray click. */
export function ApiKeyModal({
  open,
  projectName,
  apiKey,
  onRegister,
  onDone,
}: {
  open: boolean;
  projectName: string;
  apiKey: string;
  onRegister: () => void;
  onDone: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={() => {}}
      dismissible={false}
      title="Project API key"
      description={`The API key for ${projectName}.`}
      footer={
        <>
          <Button onClick={onRegister}>Register addresses now</Button>
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </>
      }
    >
      <MonoBox value={apiKey} copyLabel="Copy key" />
      <p className="mt-4 flex gap-3 rounded-control bg-warn-soft px-4 py-3 text-warn">
        <TriangleAlert size={18} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
        This key is shown only once. Copy it now and give it to the project manager.
      </p>
    </Dialog>
  );
}
