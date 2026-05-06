// src/app/transactions/page.tsx
"use client";
import { TransactionForm } from "@/components/modals/TransactionForm";
import { useSearchParams } from "next/navigation";

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  return <TransactionForm type="in" allowTypeSwitch autoOpenScanner={searchParams.get("scan") === "1"} />;
}
