"use client";

import { KeyRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { useSaveProjectKey } from "./hooks";

export function ProjectKeyPrompt({ projectId, onRotate }: { projectId: string; onRotate: () => void }) {
  const save = useSaveProjectKey(projectId);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) {
      setError("Enter the project's API key.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    save.mutate(key, {
      onSuccess: () => {
        setKey("");
        save.reset();
      },
      onError: (caught) => {
        setError(errorText({ code: errorCode(caught) }));
        inputRef.current?.focus();
      },
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center">
      <div className="kpi-icon" aria-hidden="true">
        <KeyRound size={20} strokeWidth={1.5} />
      </div>
      <p className="mt-4 font-semibold">{errorText({ code: "project_key_invalid" })}</p>
      <p className="mt-1 text-ink-2">
        Address routes accept only the project&apos;s own key. It is kept for this browser session.
      </p>
      <form onSubmit={submit} noValidate className="mt-6 w-full text-left">
        <Field label="Project API key" error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              ref={inputRef}
              id={id}
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="mono"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="link font-medium" onClick={onRotate}>
            Lost it? Rotate API key
          </button>
          <Button type="submit" variant="primary" busy={save.isPending}>
            {save.isPending ? "Checking…" : "Use this key"}
          </Button>
        </div>
      </form>
    </div>
  );
}
