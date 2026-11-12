import Avatar from "boring-avatars";
import { AVATAR_COLORS } from "@/lib/palette";

export function Identicon({ seed, size = 20 }: { seed: string; size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      <Avatar name={seed} variant="beam" size={size} colors={AVATAR_COLORS} />
    </span>
  );
}
