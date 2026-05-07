// src/app/transactions/adj/page.tsx
"use client";
import { TransactionForm } from "@/components/modals/TransactionForm";
import { useSearchParams } from "next/navigation";

export default function TxAdjPage() {
  const searchParams = useSearchParams();
  return <TransactionForm type="adj" initialItemCode={searchParams.get("item") ?? undefined} />;
}
