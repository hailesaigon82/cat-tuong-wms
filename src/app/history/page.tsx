// src/app/history/page.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, Badge, Alert, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { ApiTransaction, TransactionListResponse } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { in: "Nhập kho", out: "Xuất kho", adj: "Điều chỉnh" };
const TYPE_COLOR: Record<string, string> = {
  in: "text-green-600", out: "text-red-600", adj: "text-amber-600",
};

const LIMIT = 20;
type HistoryTab = "stock" | "adjustment";

function formatQty(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

const TAB_LABEL: Record<HistoryTab, string> = {
  stock: "Xuất nhập",
  adjustment: "Điều chỉnh kho",
};

function sortByNewest(a: ApiTransaction, b: ApiTransaction) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export default function HistoryPage() {
  const [txs, setTxs]       = useState<ApiTransaction[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [activeTab, setActiveTab] = useState<HistoryTab>("stock");
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const requestSeq = useRef(0);

  const totalPages = Math.ceil(total / LIMIT);

  const loadStockPage = async (p: number): Promise<TransactionListResponse> => {
    const fetchLimit = LIMIT * p;
    const [inRes, outRes] = await Promise.all([
      api.get<TransactionListResponse>(`/transactions?limit=${fetchLimit}&page=1&type=in`),
      api.get<TransactionListResponse>(`/transactions?limit=${fetchLimit}&page=1&type=out`),
    ]);
    const merged = [...inRes.data, ...outRes.data].sort(sortByNewest);
    return {
      data: merged.slice((p - 1) * LIMIT, p * LIMIT),
      pagination: {
        total: inRes.pagination.total + outRes.pagination.total,
        page: p,
        limit: LIMIT,
        totalPages: Math.ceil((inRes.pagination.total + outRes.pagination.total) / LIMIT),
      },
    };
  };

  const loadPage = useCallback(async (p: number) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError("");
    try {
      const res = activeTab === "stock"
        ? await loadStockPage(p)
        : await api.get<TransactionListResponse>(`/transactions?limit=${LIMIT}&page=${p}&type=adj`);
      if (requestSeq.current !== seq) return;
      setTxs(res.data);
      setTotal(res.pagination.total);
      setPage(p);
      // Scroll lên đầu khi chuyển trang
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (requestSeq.current === seq) {
        setError(e instanceof ApiError ? e.message : "Không thể tải lịch sử");
      }
    } finally {
      if (requestSeq.current === seq) {
        setLoading(false);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  return (
    <AppShell title="Lịch sử xuất/nhập/điều chỉnh kho">
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <Card>
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex gap-2">
            {(["stock", "adjustment"] as HistoryTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-[#185FA5] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Tổng {total} giao dịch · Trang {page}/{totalPages || 1}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8 text-sm">Đang tải...</div>
        ) : (
          <>
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
                    {t.note && (
                      <div className="text-xs text-gray-400 mt-0.5 italic truncate">{t.note}</div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-sm font-semibold font-mono ${TYPE_COLOR[t.type]}`}>
                      {t.type === "in" ? "+" : t.type === "out" ? "−" : "≈"}{formatQty(t.qty)}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtCurrency(t.totalPrice)}</div>
                    <div className="mt-0.5">
                      <Badge variant={t.type}>{TYPE_LABEL[t.type]}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {txs.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">Chưa có giao dịch nào</div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => loadPage(page - 1)}
                >
                  ← Trước
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                    // Hiện 5 trang xung quanh trang hiện tại
                    let p: number;
                    if (totalPages <= 5) {
                      p = idx + 1;
                    } else if (page <= 3) {
                      p = idx + 1;
                    } else if (page >= totalPages - 2) {
                      p = totalPages - 4 + idx;
                    } else {
                      p = page - 2 + idx;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => loadPage(p)}
                        className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                          p === page
                            ? "bg-[#185FA5] text-white font-semibold"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <Button
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => loadPage(page + 1)}
                >
                  Sau →
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </AppShell>
  );
}
