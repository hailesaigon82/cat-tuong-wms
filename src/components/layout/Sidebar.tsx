// src/components/layout/Sidebar.tsx
"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore, ROLE_NAMES } from "@/store";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Alert, Button, FormGroup, Input, Modal } from "@/components/ui";
import { ChevronDown, KeyRound, Settings, X } from "lucide-react";

type NavItem =
  | { path: string; label: string; icon: string; permission: string; permissions?: never }
  | { path: string; label: string; icon: string; permissions: string[]; permission?: never };

const NAV: NavItem[] = [
  { path: "/items",            label: "Hàng hóa",   icon: "📦", permission: "view_items"     },
  { path: "/transactions",     label: "Xuất Nhập",  icon: "↕️", permissions: ["tx_in", "tx_out"] },
  { path: "/transactions/adj", label: "Điều chỉnh", icon: "⚖️", permission: "tx_adj"         },
  { path: "/history",          label: "Lịch sử",    icon: "📋", permission: "view_history"   },
  { path: "/users",            label: "Người dùng", icon: "👥", permission: "manage_users"   },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const logout      = useAppStore((s) => s.logout);
  const changePassword = useAppStore((s) => s.changePassword);
  const can         = useAppStore((s) => s.can);
  const router      = useRouter();
  const pathname    = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  if (!currentUser) return null;
  const canSeeNavItem = (n: NavItem) => {
    if (Array.isArray(n.permissions)) return n.permissions.some((permission) => can(permission));
    return typeof n.permission === "string" && can(n.permission);
  };
  const visibleNav = NAV.filter(canSeeNavItem);

  const navigate = (path: string) => {
    router.push(path);
    onClose?.();
  };

  const openPasswordModal = () => {
    setUserMenuOpen(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const openSettings = () => {
    setUserMenuOpen(false);
    navigate("/settings");
  };

  const submitChangePassword = async () => {
    const currentPassword = passwordForm.currentPassword;
    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Xác nhận mật khẩu mới không khớp");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");
    try {
      await changePassword(currentPassword, newPassword);
      setShowPasswordModal(false);
      router.replace("/login");
      onClose?.();
    } catch (e) {
      setPasswordError(e instanceof ApiError ? e.message : "Đổi mật khẩu thất bại");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <aside className="w-[220px] bg-[#1a1a2e] text-white flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      {/* Logo + close button (mobile) */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <span className="text-2xl">🌸</span>
          <div>
            <div className="text-sm font-bold leading-tight">Cát Tường</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">WMS</div>
          </div>
        </button>
        {/* Nút đóng chỉ hiện trên mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="relative border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setUserMenuOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-2 rounded-md text-left transition-colors hover:bg-white/5"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight text-white">
              {currentUser.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-gray-400">
              {ROLE_NAMES[currentUser.role.code] ?? currentUser.role.name}
            </span>
          </span>
          <ChevronDown size={15} className={cn("shrink-0 text-gray-400 transition-transform", userMenuOpen && "rotate-180")} />
        </button>

        {userMenuOpen && (
          <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-20 rounded-lg border border-white/10 bg-[#24243d] py-1 shadow-xl">
            {currentUser.role.code === "admin" && (
              <button
                type="button"
                onClick={openSettings}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-white/10"
              >
                <Settings size={15} />
                Cài đặt
              </button>
            )}
            <button
              type="button"
              onClick={openPasswordModal}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-white/10"
            >
              <KeyRound size={15} />
              Đổi mật khẩu
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleNav.map((n) => {
          const active = n.path === "/transactions"
            ? ["/transactions", "/transactions/in", "/transactions/out"].includes(pathname)
            : pathname === n.path || pathname.startsWith(n.path + "/");
          return (
            <button
              key={n.path}
              onClick={() => navigate(n.path)}
              className={cn(
                "w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-sm transition-colors",
                active ? "bg-[#185FA5] text-white" : "text-gray-300 hover:bg-white/5"
              )}
            >
              <span className="text-base">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}>
        <button
          onClick={async () => { await logout(); router.replace("/login"); }}
          className="w-full py-2 bg-white/10 hover:bg-white/20 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Đăng xuất
        </button>
      </div>

      {showPasswordModal && (
        <Modal
          title="Đổi mật khẩu"
          onClose={() => setShowPasswordModal(false)}
          footer={<>
            <Button onClick={() => setShowPasswordModal(false)} disabled={passwordSaving}>Hủy</Button>
            <Button variant="primary" onClick={submitChangePassword} disabled={passwordSaving}>
              {passwordSaving ? "Đang đổi..." : "Xác nhận"}
            </Button>
          </>}
        >
          {passwordError && <div className="mb-4"><Alert type="error" message={passwordError} /></div>}
          <div className="space-y-4">
            <FormGroup label="Mật khẩu hiện tại" required>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                autoComplete="current-password"
              />
            </FormGroup>
            <FormGroup label="Mật khẩu mới" required>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                autoComplete="new-password"
              />
            </FormGroup>
            <FormGroup label="Xác nhận mật khẩu mới" required>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
            </FormGroup>
          </div>
        </Modal>
      )}
    </aside>
  );
}
