// src/components/layout/HydrationProvider.tsx
"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store";

// Wrap toàn bộ app — gọi /auth/me khi page load để khôi phục session
export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
