// src/app/dashboard/page.tsx
"use client";
import { AppShell } from "@/components/layout/AppShell";
import { useAppStore } from "@/store";

export default function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);

  return (
    <AppShell title="Xin chào">
      <div className="flex min-h-[55vh] items-center justify-center text-center">
        <p className="max-w-xl text-lg font-medium leading-8 text-gray-700">
          Chào {currentUser?.name ?? "bạn"}, chúc bạn một ngày làm việc thuận lợi, rõ ràng và hiệu quả.
        </p>
      </div>
    </AppShell>
  );
}
