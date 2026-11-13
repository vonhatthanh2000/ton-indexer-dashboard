import type { Metadata } from "next";
import { AddressesPage } from "@/features/project/addresses";

export const metadata: Metadata = { title: "Addresses" };

export default function Page() {
  return <AddressesPage />;
}
