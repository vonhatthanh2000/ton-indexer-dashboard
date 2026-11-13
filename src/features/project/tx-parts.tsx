"use client";

import { AddressChip, type AddressFormat } from "@/components/chain/address-chip";
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

/** Who sent the incoming message; "external" when there is none (e.g. a wallet sending). */
export function SenderCell({ tx, format }: { tx: Transaction; format?: AddressFormat }) {
  return tx.sender ? <AddressChip address={tx.sender} format={format} /> : <Pill tone="neutral">external</Pill>;
}

/** The first out-message destination, plus "+N" when there are more (all are in the row detail). */
export function DestinationCell({ tx, format }: { tx: Transaction; format?: AddressFormat }) {
  const destinations = tx.outMsgs.map((message) => message.destination).filter((value): value is string => Boolean(value));
  if (destinations.length === 0) return <span className="text-ink-2">—</span>;
  const more = destinations.length - 1;
  return (
    <span className="inline-flex items-center gap-2">
      <AddressChip address={destinations[0]} format={format} />
      {more > 0 ? (
        <span className="text-ink-2" title={`${more} more destination${more === 1 ? "" : "s"}`}>
          +{more}
        </span>
      ) : null}
    </span>
  );
}

export function Opcode({ value }: { value: string | null }) {
  return value ? <span className="mono">{value}</span> : <span className="text-ink-2">—</span>;
}
