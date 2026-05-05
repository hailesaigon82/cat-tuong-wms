// src/app/dashboard/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, Card, CardHeader, Badge, Table, Th, Td, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { DashboardSummary, ApiTransaction } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { in: "Nhập kho", out: "Xuất kho", adj: "Điều chỉnh" };

export default function DashboardPage() {
  const can = useAppStore((s) => s.can);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recent, setRecent]   = useState<ApiTransaction[]>([]);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sum, txRes] = await Promise.all([
          api.get<DashboardSummary>("/transactions/summary"),
          api.get<{ data: ApiTransaction[] }>("/transactions?limit=8"),
        ]);
        setSummary(sum);
        setRecent(txRes.data);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <AppShell title="Tổng quan"><div className="text-gray-400 text-sm">Đang tải...</div></AppShell>;
  if (error)   return <AppShell title="Tổng quan"><Alert type="error" message={error} /></AppShell>;

  return (
    <AppShell title="Tổng quan">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Tổng mặt hàng"         value={summary?.totalItems ?? 0} />
        <KpiCard label="Tổng giá trị tồn kho"  value={fmtCurrency(summary?.totalInventoryValue ?? 0)} variant="success" />
        <KpiCard label="Cảnh báo tồn kho thấp" value={summary?.lowStockCount ?? 0} variant={summary?.lowStockCount ? "danger" : undefined} />
        <KpiCard label="Giao dịch hôm nay"     value={summary?.todayTransactions ?? 0} />
      </div>

      {(summary?.lowStockItems?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title={`⚠️ Hàng tồn kho dưới mức tối thiểu (${summary!.lowStockItems.length})`} />
          <Table>
            <thead><tr><Th>Mã hàng</Th><Th>Tên hàng</Th><Th>Tồn kho</Th><Th>Tối thiểu</Th><Th>ĐVT</Th></tr></thead>
            <tbody>
              {summary!.lowStockItems.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <Td><Badge variant={i.category.code}>{i.code}</Badge></Td>
                  <Td>{i.name}</Td>
                  <Td className="text-[#A32D2D] font-semibold">{i.qty}</Td>
                  <Td>{i.minQty}</Td>
                  <Td>{i.unit}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader title="Giao dịch gần đây" />
        <Table>
          <thead><tr><Th>Thời gian</Th><Th>Hàng hóa</Th><Th>Loại</Th><Th>Số lượng</Th><Th>Thực hiện bởi</Th></tr></thead>
          <tbody>
            {recent.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <Td className="text-gray-400 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString("vi-VN")}</Td>
                <Td>{t.item?.name}</Td>
                <Td><Badge variant={t.type}>{TYPE_LABEL[t.type]}</Badge></Td>
                <Td className="font-mono font-medium">{t.type === "in" ? "+" : t.type === "out" ? "−" : "≈"}{t.qty}</Td>
                <Td>{t.user?.name}</Td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td className="text-center text-gray-400 py-8 text-sm" colSpan={5}>Chưa có giao dịch nào</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </AppShell>
  );
}
