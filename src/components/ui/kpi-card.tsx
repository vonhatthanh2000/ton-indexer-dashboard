import type { LucideIcon } from "lucide-react";
import { Skeleton } from "./skeleton";

export function KpiCard({
  icon: Icon,
  label,
  value,
  title,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  title?: string;
  loading?: boolean;
}) {
  return (
    <section className="card" aria-label={label}>
      <div className="kpi-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <p className="mt-5 text-ink-2">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-24" />
      ) : (
        <p className="num mt-2 text-kpi font-bold" title={title}>
          {value}
        </p>
      )}
    </section>
  );
}
