"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store";
import type { SettingsResponse } from "@/types/api";
import { EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const isAdmin = currentUser?.role.code === "admin";

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage(null);
    api.get<SettingsResponse>("/settings")
      .then((data) => {
        if (!active) return;
        setEnabled(data.hideStock.enabled);
      })
      .catch((e) => {
        if (!active) return;
        setMessage({ type: "error", text: e instanceof ApiError ? e.message : "Không thể tải cài đặt" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdmin]);

  const toggleHideStock = async () => {
    const nextEnabled = !enabled;
    setSaving(true);
    setMessage(null);
    try {
      const data = await api.patch<SettingsResponse>("/settings/hide-stock", { enabled: nextEnabled });
      setEnabled(data.hideStock.enabled);
      setMessage({
        type: "success",
        text: data.hideStock.enabled ? "Đã bật ẩn tồn kho cho nhân viên kho" : "Đã tắt ẩn tồn kho cho nhân viên kho",
      });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof ApiError ? e.message : "Không thể cập nhật cài đặt" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Cài đặt">
      <div className="w-full max-w-[720px]">
        {!isAdmin ? (
          <Alert type="error" message="Bạn không có quyền truy cập màn cài đặt" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e5e9f0] bg-white">
            <div className="border-b border-[#eef0f5] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef3fb] text-[#185FA5]">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#0f172a]">Quyền hiển thị tồn kho</h2>
                  <p className="mt-0.5 text-xs font-medium text-[#64748b]">Áp dụng cho tài khoản có vai trò nhân viên kho</p>
                </div>
              </div>
            </div>

            <div className="p-4">
              {message && <div className="mb-4"><Alert type={message.type} message={message.text} /></div>}

              {loading ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#d6dae4] bg-[#f7f8fb] px-3 py-4 text-sm font-medium text-[#64748b]">
                  <Loader2 size={16} className="animate-spin" />
                  Đang tải cài đặt...
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-lg border border-[#e5e9f0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[#f7f8fb] text-[#64748b]">
                      <EyeOff size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#0f172a]">Ẩn tồn kho</div>
                      <div className="mt-1 text-[13px] leading-5 text-[#64748b]">
                        Khi bật, nhân viên kho sẽ thấy tồn kho là NA ở danh sách hàng hóa, lịch sử và form giao dịch.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleHideStock}
                    disabled={saving}
                    className={[
                      "relative h-8 w-[58px] flex-shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60",
                      enabled ? "border-[#185FA5] bg-[#185FA5]" : "border-[#cbd5e1] bg-[#e2e8f0]",
                    ].join(" ")}
                    aria-label="Ẩn tồn kho"
                    aria-pressed={enabled}
                  >
                    <span
                      className={[
                        "absolute top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow-sm transition",
                        enabled ? "left-[28px]" : "left-1",
                      ].join(" ")}
                    >
                      {saving && <Loader2 size={13} className="animate-spin text-[#64748b]" />}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
