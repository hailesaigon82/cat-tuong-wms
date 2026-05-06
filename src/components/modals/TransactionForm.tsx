// src/components/modals/TransactionForm.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Alert, Badge, Card, FormGroup, Select, Input, Textarea } from "@/components/ui";
import { QRScanner } from "@/components/qr/QRScanner";
import { api, ApiError } from "@/lib/api";
import { cn, fmtCurrency } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ArrowDownToLine, ArrowUpFromLine, Minus, Plus, QrCode } from "lucide-react";
import type { ApiItem, ApiTransaction, TransactionListResponse, TransactionType } from "@/types/api";

const CONFIG: Record<TransactionType, { title: string; qtyLabel: string }> = {
  in:  { title: "Nhập kho",           qtyLabel: "Số lượng nhập"           },
  out: { title: "Xuất kho",           qtyLabel: "Số lượng xuất"           },
  adj: { title: "Điều chỉnh tồn kho", qtyLabel: "Số lượng mới (chính xác)" },
};

const TYPE_LABEL: Record<TransactionType, string> = {
  in: "Nhập kho",
  out: "Xuất kho",
  adj: "Điều chỉnh",
};

const TYPE_TEXT: Record<TransactionType, string> = {
  in: "text-green-600",
  out: "text-red-600",
  adj: "text-amber-600",
};

function useDebounce<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

interface TransactionFormProps {
  type: TransactionType;
  allowTypeSwitch?: boolean;
}

export function TransactionForm({ type, allowTypeSwitch = false }: TransactionFormProps) {
  const can = useAppStore((s) => s.can);
  const [items, setItems]       = useState<ApiItem[]>([]);
  const [itemId, setItemId]     = useState<number | "">("");
  const [selectedItem, setSelectedItem] = useState<ApiItem | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [txType, setTxType]     = useState<TransactionType>(type);
  const [qty, setQty]           = useState("1");
  const [note, setNote]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [alert, setAlert]       = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const [recentTxs, setRecentTxs] = useState<ApiTransaction[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");
  const debouncedItemSearch = useDebounce(itemSearch, 300);

  const cfg = allowTypeSwitch ? { title: "Xuất Nhập", qtyLabel: "Số lượng" } : CONFIG[txType];
  const qtyNum = parseInt(qty) || 0;
  const canIn = can("tx_in");
  const canOut = can("tx_out");

  useEffect(() => {
    if (!allowTypeSwitch) {
      setTxType(type);
      return;
    }
    if (txType === "in" && !canIn && canOut) setTxType("out");
    if (txType === "out" && !canOut && canIn) setTxType("in");
  }, [allowTypeSwitch, canIn, canOut, txType, type]);

  useEffect(() => {
    let active = true;
    const query = debouncedItemSearch.trim();
    setLoading(true);
    api.get<ApiItem[]>(
      query
        ? `/items?search=${encodeURIComponent(query)}&limit=20`
        : "/items?limit=20"
    )
      .then((data) => {
        if (!active) return;
        setItems(() => {
          if (!selectedItem || data.some((i) => i.id === selectedItem.id)) return data;
          return [selectedItem, ...data];
        });
      })
      .catch(() => {
        if (active) setItems(selectedItem ? [selectedItem] : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedItemSearch, selectedItem]);

  const loadRecentTransactions = useCallback(async (nextItemId: number) => {
    setRecentLoading(true);
    setRecentError("");
    try {
      const res = await api.get<TransactionListResponse>(
        `/transactions?limit=3&page=1&itemId=${nextItemId}`
      );
      setRecentTxs(res.data);
    } catch (e) {
      setRecentTxs([]);
      setRecentError(e instanceof ApiError ? e.message : "Không thể tải giao dịch gần nhất");
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setRecentTxs([]);
      setRecentError("");
      return;
    }
    loadRecentTransactions(selectedItem.id);
  }, [loadRecentTransactions, selectedItem]);

  // Xử lý khi scan QR hàng hóa
  // Hỗ trợ cả "ITEM-H0001" lẫn "H0001"
  const handleQRScan = async (data: string) => {
    const code = data.startsWith("ITEM-") ? data.replace("ITEM-", "") : data;
    const item = items.find((i) => i.code.toUpperCase() === code.toUpperCase());
    if (item) {
      setItemId(item.id);
      setSelectedItem(item);
      setShowScanner(false);
      setAlert(null);
    } else {
      try {
        const matchedItems = await api.get<ApiItem[]>(`/items?code=${encodeURIComponent(code)}`);
        const matchedItem = matchedItems[0];
        if (!matchedItem) {
          setAlert({ msg: "Không tìm thấy hàng hóa hoặc bạn không có quyền truy cập", type: "error" });
          setShowScanner(false);
          return;
        }
        setItems((current) => {
          if (current.some((i) => i.id === matchedItem.id)) return current;
          return [...current, matchedItem].sort((a, b) => a.code.localeCompare(b.code));
        });
        setItemId(matchedItem.id);
        setSelectedItem(matchedItem);
        setShowScanner(false);
        setAlert(null);
      } catch (e) {
        setAlert({ msg: e instanceof ApiError ? e.message : "Không tìm thấy hàng hóa hoặc bạn không có quyền truy cập", type: "error" });
        setShowScanner(false);
      }
    }
  };

  const selectItem = (nextItemId: number | "") => {
    setItemId(nextItemId);
    const nextItem = items.find((i) => i.id === Number(nextItemId)) ?? null;
    setSelectedItem(nextItem);
  };

  const submit = async () => {
    if (!selectedItem) { setAlert({ msg: "Vui lòng chọn hàng hóa", type: "error" }); return; }
    if (qtyNum <= 0) { setAlert({ msg: "Số lượng phải lớn hơn 0", type: "error" }); return; }
    if (txType === "adj" && !note.trim()) { setAlert({ msg: "Vui lòng nhập ghi chú điều chỉnh", type: "error" }); return; }
    setSaving(true); setAlert(null);
    try {
      const res = await api.post<{ newQty: number }>("/transactions", {
        itemId: selectedItem.id, type: txType, qty: qtyNum,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setAlert({
        msg: `✅ ${CONFIG[txType].title} thành công! Tồn kho mới: ${res.newQty} ${selectedItem.unit}`,
        type: "success",
      });
      const updatedItem = { ...selectedItem, qty: res.newQty };
      setSelectedItem(updatedItem);
      setItems((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
      await loadRecentTransactions(selectedItem.id);
      setQty("1"); setNote("");
    } catch (e) {
      setAlert({ msg: e instanceof ApiError ? e.message : "Có lỗi xảy ra", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updateQty = (nextQty: number) => {
    setQty(String(Math.max(1, nextQty)));
  };

  const selectTxType = (nextType: TransactionType) => {
    if (nextType === "in" && !canIn) return;
    if (nextType === "out" && !canOut) return;
    setTxType(nextType);
  };

  const resetForm = () => {
    setItemId("");
    setSelectedItem(null);
    setItemSearch("");
    setQty("1");
    setNote("");
    setAlert(null);
    setRecentTxs([]);
    setRecentError("");
  };

  return (
    <AppShell title={cfg.title}>
      <div className="max-w-[620px]">
        <Card className="rounded-lg shadow-sm">
          <div className="p-6">
            {alert && <div className="mb-4"><Alert type={alert.type} message={alert.msg} /></div>}

            {/* QR Scanner toggle */}
            <div className="mb-5 flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setShowScanner(!showScanner)}
                className="inline-flex items-center gap-2 rounded-md border-0 bg-[#2c3e50] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f2d3a]"
              >
                <QrCode size={16} />
                Quét mã QR hàng hóa
              </button>
              <span className="text-sm text-gray-400">hoặc chọn bên dưới</span>
            </div>

            {showScanner && (
              <div className="mb-5 p-3 border border-gray-200 rounded-lg">
                <QRScanner
                  onScan={handleQRScan}
                  onClose={() => setShowScanner(false)}
                  label="Đưa mã QR hàng hóa vào khung hình"
                />
              </div>
            )}

            <div>
              <div className="mb-[18px]">
                <FormGroup label="Hàng hóa" required>
                  <Input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Gõ mã hoặc tên hàng hóa..."
                    className="mb-2"
                  />
                  <Select
                    value={itemId}
                    onChange={(e) => selectItem(Number(e.target.value) || "")}
                    disabled={loading}
                  >
                    <option value="">
                      {loading ? "Đang tải hàng hóa..." : items.length ? "-- Chọn hàng hóa --" : "Không có kết quả"}
                    </option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} — {i.name} (Tồn: {i.qty} {i.unit})
                      </option>
                    ))}
                  </Select>
                </FormGroup>
              </div>

              <div className="mb-[18px]">
                <FormGroup label="Tồn kho">
                  <Input
                    value={selectedItem ? `${selectedItem.qty} ${selectedItem.unit}` : ""}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Chọn hàng hóa để xem tồn kho"
                  />
                </FormGroup>
              </div>

              {allowTypeSwitch && (
                <div className="mb-[18px]">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="group" aria-label="Loại phiếu">
                    <button
                      type="button"
                      onClick={() => selectTxType("out")}
                      disabled={!canOut}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] px-3.5 py-3 text-[15px] font-semibold transition-all active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40",
                        txType === "out"
                          ? "border-[#dc3545] bg-[#dc3545] text-white shadow-[0_6px_16px_-8px_#dc3545]"
                          : "border-[#dc3545] bg-white text-[#dc3545] hover:bg-red-50"
                      )}
                    >
                      <ArrowUpFromLine size={18} strokeWidth={2.2} />
                      Xuất kho
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTxType("in")}
                      disabled={!canIn}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] px-3.5 py-3 text-[15px] font-semibold transition-all active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40",
                        txType === "in"
                          ? "border-[#198754] bg-[#198754] text-white shadow-[0_6px_16px_-8px_#198754]"
                          : "border-[#198754] bg-white text-[#198754] hover:bg-green-50"
                      )}
                    >
                      <ArrowDownToLine size={18} strokeWidth={2.2} />
                      Nhập kho
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-[18px]">
                <FormGroup label={cfg.qtyLabel} required>
                  <div className="flex max-w-[220px] items-stretch overflow-hidden rounded-md border border-[#ced4da] bg-white transition focus-within:border-[#86b7fe] focus-within:shadow-[0_0_0_0.25rem_rgba(13,110,253,.25)]">
                    <button
                      type="button"
                      onClick={() => updateQty(qtyNum - 1)}
                      className="flex w-10 items-center justify-center border-r border-[#dee2e6] bg-[#f8f9fa] text-gray-800 transition-colors hover:bg-[#e9ecef] active:bg-[#dee2e6]"
                      aria-label="Giảm"
                    >
                      <Minus size={16} strokeWidth={3} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-2 text-center text-[15px] font-semibold text-gray-800 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(qtyNum + 1)}
                      className="flex w-10 items-center justify-center border-l border-[#dee2e6] bg-[#f8f9fa] text-gray-800 transition-colors hover:bg-[#e9ecef] active:bg-[#dee2e6]"
                      aria-label="Tăng"
                    >
                      <Plus size={16} strokeWidth={3} />
                    </button>
                  </div>
                </FormGroup>
              </div>

              <div className="mb-[18px]">
                <FormGroup label="Ghi chú" required={txType === "adj"}>
                  <Textarea
                    rows={4} value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[90px] resize-y"
                    placeholder={txType === "adj" ? "Lý do điều chỉnh tồn kho" : "Ghi chú cho phiếu xuất/nhập"}
                  />
                </FormGroup>
              </div>
            </div>

            <div className="mt-[22px] flex gap-2.5">
              <Button variant="primary" onClick={submit} disabled={saving || loading}>
                {saving ? "Đang xử lý..." : "Xác nhận"}
              </Button>
              <Button onClick={resetForm}>
                Làm mới
              </Button>
            </div>

            <div className="my-6 border-t border-gray-200" />

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-800">3 giao dịch gần nhất</h2>
                {selectedItem && (
                  <span className="truncate text-xs text-gray-400">{selectedItem.code} · {selectedItem.name}</span>
                )}
              </div>

              {!selectedItem ? (
                <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">
                  Chọn hàng hóa để xem giao dịch gần nhất
                </div>
              ) : recentLoading ? (
                <div className="rounded-md border border-gray-100 px-3 py-4 text-center text-sm text-gray-400">
                  Đang tải giao dịch...
                </div>
              ) : recentError ? (
                <Alert type="error" message={recentError} />
              ) : recentTxs.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">
                  Chưa có giao dịch nào cho hàng hóa này
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                  {recentTxs.map((tx) => (
                    <div key={tx.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={tx.type}>{TYPE_LABEL[tx.type]}</Badge>
                          <span className="text-xs text-gray-400">
                            {new Date(tx.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-500">
                          {tx.user?.name ?? "Không rõ người dùng"}{tx.note ? ` · ${tx.note}` : ""}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={cn("font-mono text-sm font-semibold", TYPE_TEXT[tx.type])}>
                          {tx.type === "in" ? "+" : tx.type === "out" ? "-" : "="}{tx.qty}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">{fmtCurrency(tx.totalPrice)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
