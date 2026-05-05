// src/app/history/page.tsx
"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, Badge, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { ApiTransaction, TransactionListResponse } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { in: "Nhập kho", out: "Xuất kho", adj: "Điều chỉnh" };
const TYPE_COLOR: Record<string, string> = {
  in: "text-green-600", out: "text-red-600", adj: "text-amber-600",
};

export default function HistoryPage() {
  const [txs, setTxs]         = useState<ApiTransaction[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.get<TransactionListResponse>("/transactions?limit=100")
      .then((res) => { setTxs(res.data); setTotal(res.pagination.total); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không thể tải lịch sử"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Lịch sử giao dịch">
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      <Card>
        <CardHeader title={`Lịch sử (${total} bản ghi)`} />
        {loading ? (
          <div className="text-center text-gray-400 py-8 text-sm">Đang tải...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {txs.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={t.item?.category?.code ?? ""}>{t.item?.code}</Badge>
                    <span className="text-sm font-medium text-gray-800 truncate">{t.item?.name}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(t.createdAt).toLocaleString("vi-VN")} · {t.user?.name}
                  </div>
                  {t.note && <div className="text-xs text-gray-400 mt-0.5 italic truncate">{t.note}</div>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={`text-sm font-semibold font-mono ${TYPE_COLOR[t.type]}`}>
                    {t.type === "in" ? "+" : t.type === "out" ? "−" : "≈"}{t.qty}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{fmtCurrency(t.totalPrice)}</div>
                  <Badge variant={t.type}>{TYPE_LABEL[t.type]}</Badge>
                </div>
              </div>
            ))}
            {txs.length === 0 && !loading && (
              <div className="text-center text-gray-400 py-8 text-sm">Chưa có giao dịch nào</div>
            )}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
