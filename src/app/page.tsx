// src/app/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";

function getDefaultRoute(roleCode: string) {
  if (roleCode === "warehouse") return "/transactions";
  if (roleCode === "admin" || roleCode === "manager" || roleCode === "office") return "/items";
  return "/dashboard";
}

export default function RootPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      router.replace(getDefaultRoute(currentUser.role.code));
    } else {
      router.replace("/login");
    }
  }, [currentUser, router]);

  return null;
}
