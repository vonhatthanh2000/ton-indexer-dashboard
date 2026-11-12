import Link from "next/link";
import { Identicon } from "@/components/chain/identicon";

export function ProjectCell({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/projects/${id}`} className="inline-flex items-center gap-3 font-medium">
      <Identicon seed={id} size={32} />
      <span className="link text-ink">{name}</span>
    </Link>
  );
}
