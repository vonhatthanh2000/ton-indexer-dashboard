import { CopyButton } from "./copy-button";

export function MonoBox({ value, copyLabel }: { value: string; copyLabel: string }) {
  return (
    <div className="mono-box flex items-start justify-between gap-3">
      <span className="min-w-0 select-all">{value}</span>
      <CopyButton value={value} label={copyLabel} />
    </div>
  );
}
