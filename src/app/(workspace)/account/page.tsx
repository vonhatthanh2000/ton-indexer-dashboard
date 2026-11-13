import type { Metadata } from "next";
import { AccountView } from "@/features/account/account-view";
import { ApiError } from "@/lib/client";
import type { Me } from "@/lib/types";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  // The same cached call as the layout's. A failure or a lost session is the layout's to show.
  let me: Me | null;
  try {
    me = await getMe();
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
  if (me === null) return null;
  return <AccountView initialMe={me} />;
}
