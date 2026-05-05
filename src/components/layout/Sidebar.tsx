// src/components/layout/Sidebar.tsx
"use client";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore, ROLE_NAMES } from "@/store";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/dashboard",        label: "Tổng quan",  icon: "📊", permission: "view_dashboard" },
  { path: "/items",            label: "Hàng hóa",   icon: "📦", permission: "view_items"     },
  { path: "/transactions/in",  label: "Nhập kho",   icon: "📥", permission: "tx_in"          },
  { path: "/transactions/out", label: "Xuất kho",   icon: "📤", permission: "tx_out"         },
  { path: "/transactions/adj", label: "Điều chỉnh", icon: "⚖️", permission: "tx_adj"         },
  { path: "/history",          label: "Lịch sử",    icon: "📋", permission: "view_history"   },
  { path: "/users",            label: "Người dùng", icon: "👥", permission: "manage_users"   },
];

export function Sidebar() {
  const currentUser = useAppStore((s) => s.currentUser);
  const logout      = useAppStore((s) => s.logout);
  const can         = useAppStore((s) => s.can);
  const router      = useRouter();
  const pathname    = usePathname();

  if (!currentUser) return null;
  const visibleNav = NAV.filter((n) => can(n.permission));

  return (
    <aside className="w-[220px] bg-[#1a1a2e] text-white flex flex-col flex-shrink-0 h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-white/10 flex items-center gap-2.5">
        <span className="text-2xl">🌸</span>
        <div>
          <div className="text-sm font-bold leading-tight">Cát Tường</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest">WMS</div>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-sm font-semibold text-white leading-tight truncate">{currentUser.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{ROLE_NAMES[currentUser.role.code] ?? currentUser.role.name}</div>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleNav.map((n) => {
          const active = pathname === n.path || pathname.startsWith(n.path + "/");
          return (
            <button key={n.path} onClick={() => router.push(n.path)}
              className={cn("w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-sm transition-colors",
                active ? "bg-[#185FA5] text-white" : "text-gray-300 hover:bg-white/5")}>
              <span className="text-base">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <button onClick={async () => { await logout(); router.replace("/login"); }}
          className="w-full py-2 bg-white/10 hover:bg-white/20 text-gray-300 text-sm rounded-lg transition-colors">
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
