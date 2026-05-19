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

const LIMIT = 50;
type HistoryTab = "stock" | "adjustment";

const TAB_LABEL: Record<HistoryTab, string> = {
  stock: "Xuất / Nhập",
  adjustment: "Điều chỉnh",
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

function buildDateQuery(fromDate: string, toDate: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);
  const query = params.toString();
  return query ? `&${query}` : "";
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
        ? await api.get<TransactionListResponse>(`/transactions?limit=${LIMIT}&page=${p}&types=in,out${dateQuery}`)
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
    <AppShell title="📋 Lịch sử xuất / nhập / điều chỉnh kho">
      <div className="w-full max-w-[980px]">
        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

        <div className="overflow-hidden rounded-xl border border-[#e5e9f0] bg-white">
          <div className="flex gap-1 border-b border-[#f0f2f6] bg-[#f8f9fc] px-3 py-3 sm:px-4">
              {(["stock", "adjustment"] as HistoryTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeTab === tab
                      ? "bg-white text-[#185FA5] shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                      : "text-[#64748b] hover:text-[#1a1a2e]"
                  }`}
                >
                  {TAB_LABEL[tab]}
                </button>
              ))}
          </div>

          <div className="flex flex-wrap items-end gap-2 border-b border-[#f0f2f6] bg-white px-3 py-3 sm:px-4">
                <label className="min-w-0 flex-1 sm:flex-none">
                  <span className="mb-1 block text-[11px] font-semibold text-[#64748b]">Từ</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="min-h-[34px] w-full min-w-0 rounded-lg border border-[#dde1ea] bg-white px-2.5 text-xs text-[#1a1a2e] outline-none transition focus:border-[#185FA5] sm:w-[150px]"
                    aria-label="Từ ngày"
                  />
                </label>
                <label className="min-w-0 flex-1 sm:flex-none">
                  <span className="mb-1 block text-[11px] font-semibold text-[#64748b]">Đến</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="min-h-[34px] w-full min-w-0 rounded-lg border border-[#dde1ea] bg-white px-2.5 text-xs text-[#1a1a2e] outline-none transition focus:border-[#185FA5] sm:w-[150px]"
                    aria-label="Đến ngày"
                  />
                </label>
                <Button size="sm" variant="primary" className="min-h-[34px] justify-center px-3.5 text-xs" onClick={applyDateFilter} disabled={loading}>
                  Lọc
                </Button>
                <Button size="sm" className="min-h-[34px] justify-center px-3 text-xs" onClick={clearFilters} disabled={loading}>
                  Xóa
                </Button>
            <div className="w-full text-xs font-medium text-[#94a3b8] sm:ml-auto sm:w-auto sm:self-center">
              Tổng {total} giao dịch · Trang {page}/{totalPages || 1}
            </div>
          </div>

          {loading ? (
            <div className="bg-[#f7f8fb] px-3 py-[34px] text-center text-[13px] font-medium text-[#64748b]">
              Đang tải giao dịch...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_64px_76px] gap-2 border-b border-[#eef0f5] bg-[#f8f9fc] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[#94a3b8] sm:grid-cols-[minmax(0,1fr)_80px_90px] sm:px-4">
                <div>Giao dịch</div>
                <div className="text-right">{activeTab === "stock" ? "Qty" : "Before"}</div>
                <div className="text-right">{activeTab === "stock" ? "Balance" : "After"}</div>
              </div>

              <div className="divide-y divide-[#eef0f5]">
                {txs.map((tx) => {
                  const stockAfter = getStockAfter(tx);
                  return (
                    <div key={tx.id} className="grid grid-cols-[minmax(0,1fr)_64px_76px] items-center gap-2 border-b border-[#f0f2f6] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-[#f6f9ff] sm:grid-cols-[minmax(0,1fr)_80px_90px] sm:px-4">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant={tx.type}>{TYPE_LABEL[tx.type]}</Badge>
                          <Badge variant={tx.item?.category?.code ?? ""}>{tx.item?.code ?? "-"}</Badge>
                          <span className="min-w-0 truncate text-[13px] font-semibold text-[#1a1a2e]">
                            {tx.item?.name ?? "Không rõ hàng hóa"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium leading-snug text-[#94a3b8]">
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
                      <div className={`text-right font-mono text-[13px] font-bold ${TYPE_TEXT[tx.type]}`}>
                        {activeTab === "stock"
                          ? `${tx.type === "in" ? "+" : "-"}${formatQty(tx.qty)}`
                          : formatQty(tx.stockBefore)}
                      </div>
                      <div className="text-right font-mono text-[13px] font-semibold text-[#1a1a2e]">
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
                <div className="flex items-center justify-between gap-2 border-t border-[#eef0f5] bg-white px-3 py-2.5 sm:px-4">
                  <Button
                    size="sm"
                    className="min-w-[72px] justify-center rounded-md px-2 text-xs"
                    disabled={page <= 1 || loading}
                    onClick={() => loadPage(page - 1)}
                  >
                    Trước
                  </Button>

                  <div className="text-xs font-semibold text-[#64748b] sm:hidden">
                    {page}/{totalPages}
                  </div>

                  <div className="hidden items-center gap-1 sm:flex">
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
                    className="min-w-[72px] justify-center rounded-md px-2 text-xs"
                    disabled={page >= totalPages || loading}
                    onClick={() => loadPage(page + 1)}
                  >
                    Sau
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
