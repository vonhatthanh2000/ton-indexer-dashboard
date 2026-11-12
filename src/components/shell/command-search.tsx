"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useProjects } from "@/features/admin/hooks";
import { useMyProject } from "@/features/project/hooks";
import { shorten } from "@/lib/format";
import { toFriendly } from "@/lib/ton";
import type { SessionInfo } from "@/lib/types";

interface Result {
  id: string;
  label: string;
  mono?: boolean;
  href: string;
}

function friendly(address: string): string {
  try {
    return toFriendly(address);
  } catch {
    return address;
  }
}

function AdminResults({ query, onPick }: { query: string; onPick: (result: Result) => void }) {
  const { data, isLoading } = useProjects();
  const results = useMemo(
    () =>
      (data ?? [])
        .filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
        .map((project) => ({ id: project.id, label: project.name, href: `/admin/projects/${project.id}` })),
    [data, query],
  );
  return <ResultList results={results} loading={isLoading} onPick={onPick} empty="No projects match." />;
}

function ProjectResults({ query, onPick }: { query: string; onPick: (result: Result) => void }) {
  const { data, isLoading } = useMyProject();
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.addresses ?? [])
      .map((row) => ({ raw: row.address, friendly: friendly(row.address) }))
      .filter((row) => !needle || row.friendly.toLowerCase().includes(needle) || row.raw.toLowerCase().includes(needle))
      .slice(0, 8)
      .map((row) => ({
        id: row.raw,
        label: shorten(row.friendly, 8, 6),
        mono: true,
        href: `/project/transactions?address=${encodeURIComponent(row.friendly)}`,
      }));
  }, [data, query]);
  return <ResultList results={results} loading={isLoading} onPick={onPick} empty="No addresses match." />;
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
  session,
  open,
  onOpenChange,
}: {
  session: SessionInfo;
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
            {session.role === "admin" ? "Jump to a project by name." : "Jump to an address."}
          </DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b border-line px-3 pb-3">
            <Search size={18} strokeWidth={1.5} aria-hidden="true" className="text-ink-2" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={session.role === "admin" ? "Project name" : "Address (EQ…, UQ… or 0:…)"}
              aria-label={session.role === "admin" ? "Search projects" : "Search addresses"}
              className="h-11 w-full bg-transparent outline-none"
            />
          </div>
          <div className="mt-2 max-h-80 overflow-y-auto">
            {session.role === "admin" ? (
              <AdminResults query={query} onPick={pick} />
            ) : (
              <ProjectResults query={query} onPick={pick} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
