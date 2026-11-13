"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/ui/copy-button";
import { Tooltip } from "@/components/ui/tooltip";
import { shorten } from "@/lib/format";
import { toFriendly, toNonBounceable, toRaw, tonviewerAddressUrl } from "@/lib/ton";
import { Identicon } from "./identicon";

function forms(address: string) {
  try {
    return { friendly: toFriendly(address), raw: toRaw(address), nonBounceable: toNonBounceable(address) };
  } catch {
    return null;
  }
}

export type AddressFormat = "friendly" | "raw";

/**
 * Address shown as EQ… (default) or raw `0:HEX` (`format="raw"`), shortened; every form is in the
 * tooltip, and copy copies the form shown, in full.
 */
export function AddressChip({ address, href, format = "friendly" }: { address: string; href?: string; format?: AddressFormat }) {
  const parsed = forms(address);
  if (!parsed) return <span className="mono text-ink-2">{shorten(address, 6, 4)}</span>;
  const shown = format === "raw" ? parsed.raw : parsed.friendly;
  const text = format === "raw" ? shorten(parsed.raw, 6, 4) : shorten(parsed.friendly, 4, 4);
  const tooltip = (
    <span className="mono block">
      <span className="block">{parsed.friendly}</span>
      <span className="block opacity-80">{parsed.nonBounceable}</span>
      <span className="block opacity-80">{parsed.raw}</span>
    </span>
  );
  return (
    <span className="inline-flex items-center gap-2">
      <Identicon seed={parsed.raw} />
      <Tooltip content={tooltip}>
        {href ? (
          <Link href={href} className="mono link" aria-label={`Address ${shown}`}>
            {text}
          </Link>
        ) : (
          <span className="mono" tabIndex={0} aria-label={`Address ${shown}`}>
            {text}
          </span>
        )}
      </Tooltip>
      <CopyButton value={shown} label="Copy address" />
      <a
        href={tonviewerAddressUrl(parsed.raw)}
        target="_blank"
        rel="noopener noreferrer"
        className="relative inline-grid size-7 place-items-center rounded-sm text-ink-2 after:absolute after:-inset-2 after:content-[''] hover:text-ink"
        aria-label="Open address in Tonviewer (new tab)"
      >
        <ExternalLink size={15} strokeWidth={1.5} />
      </a>
    </span>
  );
}
