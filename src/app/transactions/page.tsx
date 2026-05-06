// src/app/transactions/page.tsx
import { TransactionForm } from "@/components/modals/TransactionForm";

export default function TransactionsPage() {
  return <TransactionForm type="in" allowTypeSwitch />;
}
