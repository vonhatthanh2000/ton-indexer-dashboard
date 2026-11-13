"use client";

import { ArrowRight } from "lucide-react";
import { AddressChip } from "@/components/chain/address-chip";
import { Pill } from "@/components/ui/pill";
import { toFriendly } from "@/lib/ton";
import type { Transaction } from "@/lib/types";

export function friendly(address: string): string {
  try {
    return toFriendly(address);
  } catch {
    return address;
  }
}

/** The project's base path, `/projects/<id>`. */
export function projectBase(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

export function txHref(projectId: string, address: string): string {
  return `${projectBase(projectId)}/transactions?address=${encodeURIComponent(friendly(address))}`;
}

/** sender → first out-message destination (+N more). */
export function FlowCell({ tx }: { tx: Transaction }) {
  const destinations = tx.outMsgs.map((message) => message.destination).filter((value): value is string => Boolean(value));
  return (
    <span className="inline-flex items-center gap-2">
      {tx.sender ? <AddressChip address={tx.sender} /> : <Pill tone="neutral">external</Pill>}
      <ArrowRight size={14} strokeWidth={1.5} aria-label="to" className="text-ink-2" />
      {destinations.length > 0 ? (
        <>
          <AddressChip address={destinations[0]} />
          {destinations.length > 1 ? <span className="text-ink-2">+{destinations.length - 1}</span> : null}
        </>
      ) : (
        <span className="text-ink-2">—</span>
      )}
    </span>
  );
}

export function Opcode({ value }: { value: string | null }) {
  return value ? <span className="mono">{value}</span> : <span className="text-ink-2">—</span>;
}
