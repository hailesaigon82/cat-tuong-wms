// src/app/history/page.tsx
"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, Badge, Table, Th, Td, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { ApiTransaction, TransactionListResponse } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { in: "Nhập kho", out: "Xuất kho", adj: "Điều chỉnh" };

export default function HistoryPage() {
  const [txs, setTxs]       = useState<ApiTransaction[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

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
        <CardHeader title={`Lịch sử giao dịch (${total} bản ghi)`} />
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <Table>
            <thead>
              <tr><Th>#</Th><Th>Thời gian</Th><Th>Hàng hóa</Th><Th>Loại</Th><Th>Số lượng</Th><Th>Đơn giá</Th><Th>Thành tiền</Th><Th>Nhân viên</Th><Th>Ghi chú</Th></tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td className="text-gray-400 text-xs">{t.id}</Td>
                  <Td className="text-gray-400 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString("vi-VN")}</Td>
                  <Td>
                    <span className="flex items-center gap-1.5">
                      <Badge variant={t.item?.category?.code ?? ""}>{t.item?.code}</Badge>
                      {t.item?.name}
                    </span>
                  </Td>
                  <Td><Badge variant={t.type}>{TYPE_LABEL[t.type]}</Badge></Td>
                  <Td className="font-mono font-semibold">{t.type === "in" ? "+" : t.type === "out" ? "−" : "≈"}{t.qty}</Td>
                  <Td>{fmtCurrency(t.unitPrice)}</Td>
                  <Td>{fmtCurrency(t.totalPrice)}</Td>
                  <Td>{t.user?.name}</Td>
                  <Td className="text-gray-400 text-xs">{t.note}</Td>
                </tr>
              ))}
              {txs.length === 0 && !loading && (
                <tr><td className="text-center text-gray-400 py-8 text-sm" colSpan={9}>Chưa có giao dịch nào</td></tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </AppShell>
  );
}
