"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { formatTon, fullTimestamp, groupDigits, relativeTime } from "@/lib/format";

export function TonAmount({ nano }: { nano: string | null }) {
  if (nano === null) return <span className="text-ink-2">—</span>;
  let text;
  try {
    text = formatTon(nano);
  } catch {
    return <span className="text-ink-2">—</span>;
  }
  return (
    <Tooltip content={<span className="mono">{text.exact}</span>}>
      <span className="num whitespace-nowrap" tabIndex={0}>
        {text.short}
      </span>
    </Tooltip>
  );
}

export function LtText({ lt }: { lt: string | null }) {
  if (lt === null) return <span className="text-ink-2">—</span>;
  return (
    <span className="mono whitespace-nowrap" title="Logical time">
      {groupDigits(lt)}
    </span>
  );
}

// A minute clock shared by every RelativeTime; null on the server so the markup hydrates.
function subscribeMinute(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

function currentMinute(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/** Relative time, refreshed every minute; full local timestamp in the tooltip. */
export function RelativeTime({ iso }: { iso: string }) {
  const now = useSyncExternalStore<number | null>(subscribeMinute, currentMinute, () => null);
  return (
    <Tooltip content={now === null ? iso : fullTimestamp(iso)}>
      <time dateTime={iso} tabIndex={0} className="whitespace-nowrap">
        {now === null ? " " : relativeTime(iso, now)}
      </time>
    </Tooltip>
  );
}

export function NetworkPill() {
  return (
    <span className="pill pill-neutral">
      <Image src="/icons/ton.svg" alt="" width={14} height={14} />
      TON
    </span>
  );
}
