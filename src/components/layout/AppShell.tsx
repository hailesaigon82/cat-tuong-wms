// src/components/layout/AppShell.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/store";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function AppShell({ title, children, actions }: AppShellProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) router.replace("/login");
  }, [currentUser, router]);

  // Đóng sidebar mỗi khi đổi trang
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!currentUser) return null;

  return (
    <div className="flex overflow-hidden bg-[#f5f7fa]" style={{ height: "100dvh" }}>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 lg:relative lg:translate-x-0 lg:z-auto
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
