import type { Metadata } from "next";
import { Suspense } from "react";
import { TransactionsPage } from "@/features/project/transactions";

export const metadata: Metadata = { title: "Transactions" };

export default function Page() {
  return (
    <Suspense>
      <TransactionsPage />
    </Suspense>
  );
}
