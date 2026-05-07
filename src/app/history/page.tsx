"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Alert, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ApiTransaction, TransactionListResponse } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { in: "Nhập kho", out: "Xuất kho", adj: "Điều chỉnh" };
const TYPE_TEXT: Record<string, string> = {
  in: "text-green-600",
  out: "text-red-600",
  adj: "text-amber-600",
};

const LIMIT = 20;
type HistoryTab = "stock" | "adjustment";

const TAB_LABEL: Record<HistoryTab, string> = {
  stock: "Xuất/Nhập transaction",
  adjustment: "Điều chỉnh transaction",
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatQty(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(round2(value));
}

function getStockAfter(tx: ApiTransaction) {
  if (tx.stockBefore === null || tx.stockBefore === undefined) return null;
  if (tx.type === "in") return round2(tx.stockBefore + tx.qty);
  if (tx.type === "out") return round2(tx.stockBefore - tx.qty);
  return tx.qty;
}

function sortByNewest(a: ApiTransaction, b: ApiTransaction) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function buildDateQuery(fromDate: string, toDate: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);
  const query = params.toString();
  return query ? `&${query}` : "";
}

async function loadStockPage(p: number, dateQuery: string): Promise<TransactionListResponse> {
  const fetchLimit = LIMIT * p;
  const [inRes, outRes] = await Promise.all([
    api.get<TransactionListResponse>(`/transactions?limit=${fetchLimit}&page=1&type=in${dateQuery}`),
    api.get<TransactionListResponse>(`/transactions?limit=${fetchLimit}&page=1&type=out${dateQuery}`),
  ]);
  const total = inRes.pagination.total + outRes.pagination.total;
  const merged = [...inRes.data, ...outRes.data].sort(sortByNewest);
  return {
    data: merged.slice((p - 1) * LIMIT, p * LIMIT),
    pagination: {
      total,
      page: p,
      limit: LIMIT,
      totalPages: Math.ceil(total / LIMIT),
    },
  };
}

export default function HistoryPage() {
  const [txs, setTxs] = useState<ApiTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<HistoryTab>("stock");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSeq = useRef(0);

  const totalPages = Math.ceil(total / LIMIT);
  const dateQuery = buildDateQuery(appliedFromDate, appliedToDate);

  const loadPage = useCallback(async (p: number) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError("");
    try {
      const res = activeTab === "stock"
        ? await loadStockPage(p, dateQuery)
        : await api.get<TransactionListResponse>(`/transactions?limit=${LIMIT}&page=${p}&type=adj${dateQuery}`);
      if (requestSeq.current !== seq) return;
      setTxs(res.data);
      setTotal(res.pagination.total);
      setPage(p);
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
  }, [activeTab, dateQuery]);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const applyDateFilter = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
  };

  return (
    <AppShell title="Lịch sử xuất/nhập/điều chỉnh kho">
      <div className="w-full max-w-[980px]">
        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

        <div className="overflow-hidden rounded-xl border border-[#e6e9f0] bg-white shadow-[0_14px_32px_-16px_rgba(15,23,42,0.18),0_4px_10px_-4px_rgba(15,23,42,0.06)]">
          <div className="border-b border-[#e6e9f0] bg-white px-3.5 py-3 sm:px-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f7f8fb] p-1 sm:max-w-[420px]">
              {(["stock", "adjustment"] as HistoryTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-2.5 py-2 text-xs font-bold transition ${
                    activeTab === tab
                      ? "bg-white text-[#1d4ed8] shadow-sm"
                      : "text-[#64748b] hover:bg-white/70 hover:text-[#0f172a]"
                  }`}
                >
                  {TAB_LABEL[tab]}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[150px_150px_auto_auto]">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="min-h-[38px] rounded-xl border border-[#d6dae4] bg-white px-3 text-sm text-[#0f172a] outline-none transition hover:border-[#b9c0cd] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                aria-label="Từ ngày"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="min-h-[38px] rounded-xl border border-[#d6dae4] bg-white px-3 text-sm text-[#0f172a] outline-none transition hover:border-[#b9c0cd] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                aria-label="Đến ngày"
              />
              <Button size="sm" variant="primary" onClick={applyDateFilter} disabled={loading}>
                Lọc
              </Button>
              <Button size="sm" onClick={clearFilters} disabled={loading}>
                Xóa
              </Button>
            </div>

            <div className="mt-2 text-xs font-medium text-[#94a3b8]">
              Tổng {total} giao dịch · Trang {page}/{totalPages || 1}
            </div>
          </div>

          {loading ? (
            <div className="bg-[#f7f8fb] px-3 py-[34px] text-center text-[13px] font-medium text-[#64748b]">
              Đang tải giao dịch...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_64px_76px] gap-2 border-b border-[#eef0f5] bg-[#f7f8fb] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#64748b] sm:grid-cols-[minmax(0,1fr)_96px_108px]">
                <div>Transaction</div>
                <div className="text-right">{activeTab === "stock" ? "Qty" : "Before"}</div>
                <div className="text-right">{activeTab === "stock" ? "Balance" : "After"}</div>
              </div>

              <div className="divide-y divide-[#eef0f5]">
                {txs.map((tx) => {
                  const stockAfter = getStockAfter(tx);
                  return (
                    <div key={tx.id} className="grid grid-cols-[minmax(0,1fr)_64px_76px] gap-2 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_96px_108px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={tx.type}>{TYPE_LABEL[tx.type]}</Badge>
                          <Badge variant={tx.item?.category?.code ?? ""}>{tx.item?.code ?? "-"}</Badge>
                          <span className="min-w-0 truncate text-sm font-semibold text-[#0f172a]">
                            {tx.item?.name ?? "Không rõ hàng hóa"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium leading-snug text-[#64748b]">
                          <span>{new Date(tx.createdAt).toLocaleString("vi-VN")}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.user?.name ?? "Không rõ người dùng"}</span>
                          {tx.note && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="min-w-0 break-words">{tx.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`self-center text-right font-mono text-sm font-semibold ${TYPE_TEXT[tx.type]}`}>
                        {activeTab === "stock"
                          ? `${tx.type === "in" ? "+" : "-"}${formatQty(tx.qty)}`
                          : formatQty(tx.stockBefore)}
                      </div>
                      <div className="self-center text-right font-mono text-sm font-semibold text-[#0f172a]">
                        {formatQty(stockAfter)}
                      </div>
                    </div>
                  );
                })}

                {txs.length === 0 && (
                  <div className="bg-[#f7f8fb] px-3 py-[34px] text-center text-[13px] font-medium text-[#64748b]">
                    Chưa có giao dịch nào cho bộ lọc này
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-[#eef0f5] bg-white px-3.5 py-3">
                  <Button
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => loadPage(page - 1)}
                  >
                    ← Trước
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
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
                          type="button"
                          onClick={() => loadPage(p)}
                          className={`h-8 w-8 rounded-lg text-xs transition-colors ${
                            p === page
                              ? "bg-[#2563eb] font-semibold text-white"
                              : "text-[#64748b] hover:bg-[#f7f8fb] hover:text-[#0f172a]"
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
        </div>
      </div>
    </AppShell>
  );
}
