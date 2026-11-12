"use client";

import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { Tooltip } from "@/components/ui/tooltip";
import { shorten } from "@/lib/format";
import { tonviewerTxUrl } from "@/lib/ton";

function explorerUrl(hash: string): string | null {
  try {
    return tonviewerTxUrl(hash);
  } catch {
    return null;
  }
}

export function HashChip({ hash }: { hash: string }) {
  const url = explorerUrl(hash);
  return (
    <span className="inline-flex items-center gap-2">
      <Tooltip content={<span className="mono">{hash}</span>}>
        <span className="mono" tabIndex={0} aria-label={`Transaction hash ${hash}`}>
          {shorten(hash, 4, 4)}
        </span>
      </Tooltip>
      <CopyButton value={hash} label="Copy transaction hash" />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative inline-grid size-7 place-items-center rounded-sm text-ink-2 after:absolute after:-inset-2 after:content-[''] hover:text-ink"
          aria-label="Open transaction in Tonviewer (new tab)"
        >
          <ExternalLink size={15} strokeWidth={1.5} />
        </a>
      ) : null}
    </span>
  );
}
