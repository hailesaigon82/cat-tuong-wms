// src/app/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";

export default function RootPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      router.replace(currentUser.role.code === "warehouse" ? "/transactions?scan=1" : "/dashboard");
    } else {
      router.replace("/login");
    }
  }, [currentUser, router]);

  return null;
}
