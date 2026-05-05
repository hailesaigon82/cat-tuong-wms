// src/components/layout/HydrationProvider.tsx
"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store";

export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Nếu không có token → không cần hydrate, render ngay
    const token = localStorage.getItem("wms_access_token");
    if (!token) {
      setReady(true);
      return;
    }

    // Có token → hydrate với timeout 5 giây
    // Nếu backend chậm (cold start) → vẫn render sau 5s
    const timeout = setTimeout(() => setReady(true), 5000);

    hydrate().finally(() => {
      clearTimeout(timeout);
      setReady(true);
    });

    return () => clearTimeout(timeout);
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🌸</span>
          <p className="text-sm text-gray-400">Đang khởi động...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
