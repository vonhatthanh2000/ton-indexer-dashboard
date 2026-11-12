import { Pill } from "@/components/ui/pill";
import type { ProjectAddress } from "@/lib/types";

export type AddressStatus = "pending" | "syncing" | "live";

/** One pill per address, first match wins (PLAN.md Display rules). */
export function addressStatus(address: Pick<ProjectAddress, "startLt" | "state" | "stillSyncing">): AddressStatus {
  if (address.startLt === null) return "pending";
  if (address.state === "resyncing" || address.stillSyncing) return "syncing";
  return "live";
}

export function AddressStatusPill({ status }: { status: AddressStatus }) {
  if (status === "pending") return <Pill tone="neutral" dot>Pending start</Pill>;
  if (status === "syncing") return <Pill tone="warn" dot>Syncing</Pill>;
  return <Pill tone="ok" dot>Live</Pill>;
}

export function TxStatusPill({ aborted }: { aborted: boolean | null }) {
  if (aborted === null) return <span className="text-ink-2">—</span>;
  return aborted ? <Pill tone="err" dot>Failed</Pill> : <Pill tone="ok" dot>Success</Pill>;
}
