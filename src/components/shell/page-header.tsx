import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({ title, crumbs }: { title: string; crumbs: Crumb[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-title font-semibold">{title}</h1>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-ink-2">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {last || !crumb.href ? (
                  <span className={last ? "text-primary-text" : undefined} aria-current={last ? "page" : undefined}>
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="hover:text-ink">
                    {crumb.label}
                  </Link>
                )}
                {last ? null : <span aria-hidden="true">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
