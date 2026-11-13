"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Me } from "@/lib/types";

interface Result {
  id: string;
  label: string;
  mono?: boolean;
  href: string;
}

// Jumps to one of the user's projects (me.projects).
function ProjectResults({ me, query, onPick }: { me: Me; query: string; onPick: (result: Result) => void }) {
  const results = useMemo(
    () =>
      me.projects
        .filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
        .map((project) => ({ id: project.id, label: project.name, href: `/projects/${project.id}` })),
    [me.projects, query],
  );
  return <ResultList results={results} loading={false} onPick={onPick} empty="No projects match." />;
}

function ResultList({
  results,
  loading,
  onPick,
  empty,
}: {
  results: Result[];
  loading: boolean;
  onPick: (result: Result) => void;
  empty: string;
}) {
  if (loading) return <p className="px-3 py-4 text-ink-2">Loading…</p>;
  if (results.length === 0) return <p className="px-3 py-4 text-ink-2">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1" aria-label="Results">
      {results.map((result) => (
        <li key={result.id}>
          <button
            type="button"
            className={`menu-item w-full text-left hover:bg-neutral-soft focus-visible:bg-neutral-soft ${result.mono ? "mono" : ""}`}
            onClick={() => onPick(result)}
          >
            {result.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CommandSearch({
  me,
  open,
  onOpenChange,
}: {
  me: Me;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  function pick(result: Result) {
    onOpenChange(false);
    setQuery("");
    router.push(result.href);
  }
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fade-in" />
        <DialogPrimitive.Content className="dialog-panel dialog-panel-top fade-in">
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Jump to a project by name.
          </DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b border-line px-3 pb-3">
            <Search size={18} strokeWidth={1.5} aria-hidden="true" className="text-ink-2" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Project name"
              aria-label="Search projects"
              className="h-11 w-full bg-transparent outline-none"
            />
          </div>
          <div className="mt-2 max-h-80 overflow-y-auto">
            <ProjectResults me={me} query={query} onPick={pick} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
