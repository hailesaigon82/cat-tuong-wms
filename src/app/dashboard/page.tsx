// src/app/dashboard/page.tsx
"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, Card, CardHeader, Badge, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { DashboardSummary, ApiTransaction } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { in: "Nhập kho", out: "Xuất kho", adj: "Điều chỉnh" };
const TYPE_COLOR: Record<string, string> = {
  in:  "text-green-600",
  out: "text-red-600",
  adj: "text-amber-600",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recent, setRecent]   = useState<ApiTransaction[]>([]);
  const [error, setError]     = useState("");
  const [recentError, setRecentError] = useState("");
  const [recentLoading, setRecentLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const sum = await api.get<DashboardSummary>("/transactions/summary");
        setSummary(sum);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Không thể tải dữ liệu");
        return;
      } finally {
        setLoading(false);
      }

      try {
        const txRes = await api.get<{ data: ApiTransaction[] }>("/transactions?limit=8");
        setRecent(txRes.data);
        setRecentError("");
      } catch (e) {
        setRecentError(e instanceof ApiError ? e.message : "Không thể tải giao dịch gần đây");
      } finally {
        setRecentLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <AppShell title="Tổng quan"><div className="text-gray-400 text-sm py-8 text-center">Đang tải...</div></AppShell>;
  if (error)   return <AppShell title="Tổng quan"><Alert type="error" message={error} /></AppShell>;

  return (
    <AppShell title="Tổng quan">
      {/* KPI grid — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Tổng mặt hàng"        value={summary?.totalItems ?? 0} />
        <KpiCard label="Giá trị tồn kho"       value={fmtCurrency(summary?.totalInventoryValue ?? 0)} variant="success" />
        <KpiCard label="Tồn kho thấp"          value={summary?.lowStockCount ?? 0} variant={summary?.lowStockCount ? "danger" : undefined} />
        <KpiCard label="Giao dịch hôm nay"     value={summary?.todayTransactions ?? 0} />
      </div>

      {/* Low stock — card list thay vì table trên mobile */}
      {(summary?.lowStockItems?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title={`⚠️ Tồn kho thấp (${summary!.lowStockItems.length})`} />
          <div className="divide-y divide-gray-100">
            {summary!.lowStockItems.map((i) => (
              <div key={i.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={i.category.code}>{i.code}</Badge>
                  <span className="text-sm text-gray-700 truncate">{i.name}</span>
                </div>
                <div className="text-sm font-semibold text-[#A32D2D] flex-shrink-0 ml-2">
                  {i.qty}/{i.minQty} {i.unit}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent transactions — card list */}
      <Card>
        <CardHeader title="Giao dịch gần đây" />
        {recentError && <div className="px-4 pt-3"><Alert type="warning" message={recentError} /></div>}
        <div className="divide-y divide-gray-100">
          {recentLoading ? (
            <div className="text-center text-gray-400 py-8 text-sm">Đang tải giao dịch...</div>
          ) : recent.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-800 truncate">{t.item?.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(t.createdAt).toLocaleString("vi-VN")} · {t.user?.name}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-sm font-semibold font-mono ${TYPE_COLOR[t.type]}`}>
                  {t.type === "in" ? "+" : t.type === "out" ? "−" : "≈"}{t.qty}
                </div>
                <Badge variant={t.type}>{TYPE_LABEL[t.type]}</Badge>
              </div>
            </div>
          ))}
          {!recentLoading && recent.length === 0 && (
            <div className="text-center text-gray-400 py-8 text-sm">Chưa có giao dịch nào</div>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
