import type { ReactNode } from "react";
import { cn } from "./cn";

export type PillTone = "ok" | "warn" | "err" | "neutral" | "primary";

export function Pill({ tone, dot, children, className }: { tone: PillTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("pill", `pill-${tone}`, className)}>
      {dot ? <span className="pill-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
