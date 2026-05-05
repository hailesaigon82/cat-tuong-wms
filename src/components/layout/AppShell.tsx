// src/components/layout/AppShell.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function AppShell({ title, children, actions }: AppShellProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) router.replace("/login");
  }, [currentUser, router]);

  if (!currentUser) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fa]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          {actions && <div>{actions}</div>}
        </header>
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 fade-in">{children}</main>
      </div>
    </div>
  );
}
