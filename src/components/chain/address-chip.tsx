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

/** Address shown as EQ…; raw and UQ… in the tooltip; copy copies EQ…. */
export function AddressChip({ address, href }: { address: string; href?: string }) {
  const parsed = forms(address);
  if (!parsed) return <span className="mono text-ink-2">{shorten(address, 6, 4)}</span>;
  const text = shorten(parsed.friendly, 4, 4);
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
          <Link href={href} className="mono link" aria-label={`Address ${parsed.friendly}`}>
            {text}
          </Link>
        ) : (
          <span className="mono" tabIndex={0} aria-label={`Address ${parsed.friendly}`}>
            {text}
          </span>
        )}
      </Tooltip>
      <CopyButton value={parsed.friendly} label="Copy address" />
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
