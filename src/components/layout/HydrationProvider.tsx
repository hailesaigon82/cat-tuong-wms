// src/components/layout/HydrationProvider.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store";

export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const currentUser = useAppStore((s) => s.currentUser);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const didBootstrap = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (didBootstrap.current) return;
    didBootstrap.current = true;

    // Nếu không có token → không cần hydrate, render ngay
    const token = localStorage.getItem("wms_access_token");
    if (!token) {
      useAppStore.setState({ currentUser: null });
      setReady(true);
      return;
    }

    // Có token thì render ngay, refresh /auth/me ở nền.
    setReady(true);
    if (currentUser) {
      hydrate();
      return;
    }

    hydrate();
  }, [currentUser, hasHydrated, hydrate]);

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
