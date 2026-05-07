// src/components/modals/TransactionForm.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Badge } from "@/components/ui";
import { QRScanner } from "@/components/qr/QRScanner";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, Minus, Package, Plus, QrCode } from "lucide-react";
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

const NOTE_MAX_LENGTH = 200;
type RecentTab = "stock" | "adjustment";

const RECENT_TAB_LABEL: Record<RecentTab, string> = {
  stock: "Xuất/Nhập transaction",
  adjustment: "Điều chỉnh transaction",
};

function useDebounce<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

function getItemLabel(item: ApiItem) {
  return `${item.code} - ${item.name}`;
}

function getTransactionErrorMessage(error: unknown, txType: TransactionType) {
  if (!(error instanceof ApiError)) return "Không thể ghi nhận giao dịch, vui lòng thử lại";
  if (error.message !== "Dữ liệu không hợp lệ") return error.message;

  if (txType === "out") return "Không thể xuất kho. Vui lòng kiểm tra hàng hóa, số lượng xuất và tồn kho hiện tại";
  if (txType === "in") return "Không thể nhập kho. Vui lòng kiểm tra hàng hóa và số lượng nhập";
  return "Không thể điều chỉnh tồn kho. Vui lòng kiểm tra hàng hóa, số lượng mới và ghi chú điều chỉnh";
}

function getStockAfter(tx: ApiTransaction) {
  if (tx.stockBefore === null || tx.stockBefore === undefined) {
    return null;
  }

  if (tx.type === "in") {
    return tx.stockBefore + tx.qty;
  }

  if (tx.type === "out") {
    return tx.stockBefore - tx.qty;
  }

  return tx.qty;
}

function hasMaxTwoDecimals(value: number) {
  return Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface TransactionFormProps {
  type: TransactionType;
  allowTypeSwitch?: boolean;
  autoOpenScanner?: boolean;
}

export function TransactionForm({ type, allowTypeSwitch = false, autoOpenScanner = false }: TransactionFormProps) {
  const can = useAppStore((s) => s.can);
  const [items, setItems]       = useState<ApiItem[]>([]);
  const [itemId, setItemId]     = useState<number | "">("");
  const [selectedItem, setSelectedItem] = useState<ApiItem | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [txType, setTxType]     = useState<TransactionType>(type);
  const [qty, setQty]           = useState("1");
  const [note, setNote]         = useState("");
  const [itemsLoading, setItemsLoading] = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showScanner, setShowScanner] = useState(autoOpenScanner);
  const [alert, setAlert]       = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const [lastReversibleTx, setLastReversibleTx] = useState<ApiTransaction | null>(null);
  const [reversing, setReversing] = useState(false);
  const [recentTab, setRecentTab] = useState<RecentTab>("stock");
  const [stockRecentTxs, setStockRecentTxs] = useState<ApiTransaction[]>([]);
  const [adjustmentRecentTxs, setAdjustmentRecentTxs] = useState<ApiTransaction[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");
  const debouncedItemSearch = useDebounce(itemSearch, 300);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const recentRequestSeq = useRef(0);

  const cfg = allowTypeSwitch ? { title: "Xuất Nhập", qtyLabel: "Số lượng" } : CONFIG[txType];
  const qtyNum = Number(qty);
  const canIn = can("tx_in");
  const canOut = can("tx_out");
  const activeRecentTxs = recentTab === "stock" ? stockRecentTxs : adjustmentRecentTxs;

  const showAlert = useCallback((nextAlert: { msg: string; type: "error" | "success" }) => {
    setAlert(nextAlert);
    window.requestAnimationFrame(() => {
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      alertRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!allowTypeSwitch) {
      setTxType(type);
      return;
    }
    if (txType === "in" && !canIn && canOut) setTxType("out");
    if (txType === "out" && !canOut && canIn) setTxType("in");
  }, [allowTypeSwitch, canIn, canOut, txType, type]);

  useEffect(() => {
    if (autoOpenScanner) {
      setShowScanner(true);
    }
  }, [autoOpenScanner]);

  useEffect(() => {
    let active = true;
    const query = selectedItem && debouncedItemSearch === getItemLabel(selectedItem)
      ? ""
      : debouncedItemSearch.trim();
    setItemsLoading(true);
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
        if (active) setItemsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedItemSearch, selectedItem]);

  const loadRecentTransactions = useCallback(async (nextItemId: number) => {
    const seq = recentRequestSeq.current + 1;
    recentRequestSeq.current = seq;
    setRecentLoading(true);
    setRecentError("");
    try {
      const [stockRes, adjustmentRes] = await Promise.all([
        api.get<TransactionListResponse>(
          `/transactions?limit=3&page=1&itemId=${nextItemId}&types=in,out`
        ),
        api.get<TransactionListResponse>(
          `/transactions?limit=3&page=1&itemId=${nextItemId}&type=adj`
        ),
      ]);
      if (recentRequestSeq.current !== seq) return;
      setStockRecentTxs(stockRes.data);
      setAdjustmentRecentTxs(adjustmentRes.data);
    } catch (e) {
      if (recentRequestSeq.current !== seq) return;
      setStockRecentTxs([]);
      setAdjustmentRecentTxs([]);
      setRecentError(e instanceof ApiError ? e.message : "Không thể tải giao dịch gần nhất");
    } finally {
      if (recentRequestSeq.current === seq) {
        setRecentLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      recentRequestSeq.current += 1;
      setStockRecentTxs([]);
      setAdjustmentRecentTxs([]);
      setRecentError("");
      setRecentLoading(false);
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
      setItemSearch(getItemLabel(item));
      setItemDropdownOpen(false);
      setShowScanner(false);
      setAlert(null);
    } else {
      try {
        const matchedItems = await api.get<ApiItem[]>(`/items?code=${encodeURIComponent(code)}`);
        const matchedItem = matchedItems[0];
        if (!matchedItem) {
          showAlert({ msg: "Không tìm thấy hàng hóa hoặc bạn không có quyền truy cập", type: "error" });
          setShowScanner(false);
          return;
        }
        setItems((current) => {
          if (current.some((i) => i.id === matchedItem.id)) return current;
          return [...current, matchedItem].sort((a, b) => a.code.localeCompare(b.code));
        });
        setItemId(matchedItem.id);
        setSelectedItem(matchedItem);
        setItemSearch(getItemLabel(matchedItem));
        setItemDropdownOpen(false);
        setShowScanner(false);
        setAlert(null);
      } catch (e) {
        showAlert({ msg: e instanceof ApiError ? e.message : "Không tìm thấy hàng hóa hoặc bạn không có quyền truy cập", type: "error" });
        setShowScanner(false);
      }
    }
  };

  const selectItem = (nextItem: ApiItem) => {
    setItemId(nextItem.id);
    setSelectedItem(nextItem);
    setItemSearch(getItemLabel(nextItem));
    setItemDropdownOpen(false);
    setAlert(null);
  };

  const handleItemSearchChange = (value: string) => {
    setItemSearch(value);
    setItemDropdownOpen(true);
    if (selectedItem && value !== getItemLabel(selectedItem)) {
      setItemId("");
      setSelectedItem(null);
    }
  };

  const submit = async () => {
    if (!selectedItem) { showAlert({ msg: "Vui lòng chọn hàng hóa", type: "error" }); return; }
    if (!Number.isFinite(qtyNum)) { showAlert({ msg: "Vui lòng nhập số lượng hợp lệ", type: "error" }); return; }
    if ((txType === "in" || txType === "out") && qtyNum <= 0) { showAlert({ msg: "Vui lòng nhập số lượng lớn hơn 0", type: "error" }); return; }
    if (txType === "adj" && qtyNum < 0) { showAlert({ msg: "Số tồn mới không được nhỏ hơn 0", type: "error" }); return; }
    if (!hasMaxTwoDecimals(qtyNum)) { showAlert({ msg: "Số lượng chỉ được nhập tối đa 2 chữ số thập phân", type: "error" }); return; }
    if (txType === "out" && qtyNum > selectedItem.qty) {
      showAlert({
        msg: `Số lượng xuất (${qtyNum} ${selectedItem.unit}) vượt quá tồn kho hiện tại (${selectedItem.qty} ${selectedItem.unit})`,
        type: "error",
      });
      return;
    }
    if (!note.trim()) { showAlert({ msg: "Vui lòng nhập ghi chú", type: "error" }); return; }
    setSaving(true); setAlert(null);
    try {
      const res = await api.post<ApiTransaction & { newQty: number }>("/transactions", {
        itemId: selectedItem.id, type: txType, qty: qtyNum,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      showAlert({
        msg: `✅ ${CONFIG[txType].title} thành công! Tồn kho mới: ${res.newQty} ${selectedItem.unit}`,
        type: "success",
      });
      setLastReversibleTx(res);
      const updatedItem = { ...selectedItem, qty: res.newQty };
      setSelectedItem(updatedItem);
      setItemSearch(getItemLabel(updatedItem));
      setItems((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
      await loadRecentTransactions(selectedItem.id);
      setQty("1"); setNote("");
    } catch (e) {
      showAlert({ msg: getTransactionErrorMessage(e, txType), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const reverseLastTransaction = async () => {
    if (!lastReversibleTx || !selectedItem) return;
    setReversing(true);
    try {
      const res = await api.post<{ transaction: ApiTransaction; newQty: number }>(
        `/transactions/${lastReversibleTx.id}/reverse`
      );
      const updatedItem = { ...selectedItem, qty: res.newQty };
      setSelectedItem(updatedItem);
      setItemSearch(getItemLabel(updatedItem));
      setItems((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
      await loadRecentTransactions(updatedItem.id);
      setLastReversibleTx(null);
      showAlert({
        msg: `Đã thu hồi giao dịch #${lastReversibleTx.id}. Tồn kho mới: ${res.newQty} ${updatedItem.unit}`,
        type: "success",
      });
    } catch (e) {
      showAlert({ msg: e instanceof ApiError ? e.message : "Thu hồi giao dịch thất bại", type: "error" });
    } finally {
      setReversing(false);
    }
  };

  const updateQty = (nextQty: number) => {
    const minQty = txType === "adj" ? 0 : 0.01;
    setQty(String(Math.max(minQty, round2(nextQty))));
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
    setItemDropdownOpen(false);
    setQty("1");
    setNote("");
    setAlert(null);
    setLastReversibleTx(null);
    setStockRecentTxs([]);
    setAdjustmentRecentTxs([]);
    setRecentError("");
  };

  return (
    <AppShell title={cfg.title}>
      <div className="w-full max-w-[560px]">
        <main
          className="w-full rounded-[18px] border border-[#e6e9f0] bg-white p-5 shadow-[0_14px_32px_-16px_rgba(15,23,42,0.18),0_4px_10px_-4px_rgba(15,23,42,0.06)] sm:p-7"
          data-screen-label="Phiếu xuất nhập"
        >
          <div className="mb-[22px] flex items-center justify-between gap-4 border-b border-[#e6e9f0] pb-[18px]">
            <div className="min-w-0">
              <h1 className="m-0 text-[17px] font-bold leading-tight tracking-normal text-[#0f172a]">
                {allowTypeSwitch ? "Phiếu xuất / nhập kho" : CONFIG[txType].title}
              </h1>
              <p className="mt-0.5 text-[12.5px] font-medium text-[#64748b]">
                Chọn hàng hóa và thao tác bạn muốn thực hiện
              </p>
            </div>
            <div
              className="grid h-[38px] w-[38px] flex-shrink-0 place-items-center rounded-[10px] bg-[#dbeafe] text-[#2563eb] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]"
              aria-hidden="true"
            >
              <Package size={20} />
            </div>
          </div>

          <div className="p-0">
            {alert && (
              <div ref={alertRef} tabIndex={-1} className="mb-4 outline-none">
                {alert.type === "success" && lastReversibleTx ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-200 bg-[#EAF3DE] px-3.5 py-2.5 text-sm text-[#3B6D11]">
                    <span>{alert.msg}</span>
                    <button
                      type="button"
                      onClick={reverseLastTransaction}
                      disabled={reversing}
                      className="font-bold text-[#A32D2D] underline decoration-2 underline-offset-2 transition hover:text-[#7d2222] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reversing ? "Đang thu hồi..." : "Thu hồi"}
                    </button>
                  </div>
                ) : (
                  <Alert type={alert.type} message={alert.msg} />
                )}
              </div>
            )}

            <div className="mb-[22px] flex flex-col items-stretch gap-3 rounded-xl border border-dashed border-[#d6dae4] bg-[#f7f8fb] px-2.5 py-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setShowScanner(!showScanner)}
                className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg border-0 bg-[#0f172a] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_10px_-6px_rgba(15,23,42,0.5)] transition hover:bg-[#1e293b] active:scale-[0.98]"
              >
                <QrCode size={16} />
                Quét mã QR
              </button>
              <span className="text-center text-[13px] font-medium text-[#64748b] sm:text-left">
                hoặc tìm hàng hóa thủ công bên dưới
              </span>
            </div>

            {showScanner && (
              <div className="mb-[22px] rounded-xl border border-[#e6e9f0] p-3">
                <QRScanner
                  onScan={handleQRScan}
                  onClose={() => setShowScanner(false)}
                  label="Đưa mã QR hàng hóa vào khung hình"
                />
              </div>
            )}

            <div>
              <div className="mb-[18px]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="transaction-item-search" className="text-[13px] font-semibold text-[#0f172a]">
                    Hàng hóa <span className="text-[#ef4444]">*</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="transaction-item-search"
                    value={itemSearch}
                    onChange={(e) => handleItemSearchChange(e.target.value)}
                    onFocus={() => setItemDropdownOpen(true)}
                    onBlur={() => window.setTimeout(() => setItemDropdownOpen(false), 120)}
                    placeholder="Gõ mã hoặc tên hàng hóa..."
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={itemDropdownOpen}
                    aria-controls="transaction-item-options"
                    className={cn(
                      "w-full rounded-xl border border-[#d6dae4] bg-white px-3.5 py-[11px] pr-10 text-sm text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] hover:border-[#b9c0cd] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.15)]",
                      itemDropdownOpen && "border-[#2563eb] shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                    )}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setItemDropdownOpen((open) => !open)}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#64748b] transition hover:bg-[#f7f8fb] hover:text-[#0f172a]"
                    aria-label="Mở danh sách hàng hóa"
                  >
                    <ChevronDown size={16} />
                  </button>

                  {itemDropdownOpen && (
                    <div
                      id="transaction-item-options"
                      className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[#d6dae4] bg-white py-1 shadow-[0_14px_32px_-16px_rgba(15,23,42,0.18),0_4px_10px_-4px_rgba(15,23,42,0.06)]"
                    >
                      {itemsLoading ? (
                        <div className="px-3 py-2 text-sm font-medium text-[#94a3b8]">Đang tải hàng hóa...</div>
                      ) : items.length === 0 ? (
                        <div className="px-3 py-2 text-sm font-medium text-[#94a3b8]">Không có kết quả</div>
                      ) : (
                        items.map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectItem(i)}
                            className={cn(
                              "flex w-full border-b border-[#eef0f5] px-3.5 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-[#eff4ff]",
                              itemId === i.id && "bg-[#eff4ff]"
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-[#0f172a]">{i.code} - {i.name}</span>
                              <span className="block truncate text-xs font-medium text-[#94a3b8]">{i.category.code} · {i.category.name}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-[18px]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-[13px] font-semibold text-[#0f172a]">Tồn kho hiện tại</label>
                  <span className="text-xs font-medium text-[#94a3b8]">cập nhật theo thời gian thực</span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border-2 border-[#d6dae4] bg-[#f7f8fb] px-3.5 py-2.5 text-sm font-extrabold text-[#475569] shadow-sm",
                    selectedItem && selectedItem.qty > 0 && "border-[#059669] bg-[#d1fae5] text-[#064e3b] shadow-[0_8px_20px_-14px_rgba(5,150,105,0.9)]",
                    selectedItem && selectedItem.qty <= 0 && "border-[#e11d48] bg-[#ffe4e6] text-[#881337] shadow-[0_8px_20px_-14px_rgba(225,29,72,0.9)]"
                  )}
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full bg-[#94a3b8]",
                      selectedItem && selectedItem.qty > 0 && "bg-[#059669]",
                      selectedItem && selectedItem.qty <= 0 && "bg-[#e11d48]"
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    {selectedItem
                      ? selectedItem.qty > 0
                        ? `Còn ${selectedItem.qty} ${selectedItem.unit} trong kho`
                        : "Hết hàng"
                      : "Chọn hàng hóa để xem tồn kho"}
                  </span>
                </span>
              </div>

              {allowTypeSwitch && (
                <div className="mb-[18px]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-[13px] font-semibold text-[#0f172a]">
                      Loại phiếu <span className="text-[#ef4444]">*</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Loại phiếu">
                    <button
                      type="button"
                      onClick={() => selectTxType("out")}
                      disabled={!canOut}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] px-3.5 py-3.5 text-[14.5px] font-bold text-[#e11d48] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40",
                        txType === "out"
                          ? "border-[#e11d48] bg-[#e11d48] text-white shadow-[0_8px_22px_-10px_#e11d48,inset_0_1px_0_rgba(255,255,255,0.18)]"
                          : "border-[#f3bcc8] bg-white hover:border-[#e11d48] hover:bg-[#fff1f3]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-[22px] w-[22px] place-items-center rounded-lg bg-[#fff1f3]",
                          txType === "out" && "bg-white/20"
                        )}
                        aria-hidden="true"
                      >
                        <ArrowUpFromLine size={13} strokeWidth={2.4} />
                      </span>
                      Xuất kho
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTxType("in")}
                      disabled={!canIn}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] px-3.5 py-3.5 text-[14.5px] font-bold text-[#059669] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40",
                        txType === "in"
                          ? "border-[#059669] bg-[#059669] text-white shadow-[0_8px_22px_-10px_#059669,inset_0_1px_0_rgba(255,255,255,0.18)]"
                          : "border-[#b7ebd1] bg-white hover:border-[#059669] hover:bg-[#ecfdf5]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-[22px] w-[22px] place-items-center rounded-lg bg-[#ecfdf5]",
                          txType === "in" && "bg-white/20"
                        )}
                        aria-hidden="true"
                      >
                        <ArrowDownToLine size={13} strokeWidth={2.4} />
                      </span>
                      Nhập kho
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-[18px]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="transaction-qty" className="text-[13px] font-semibold text-[#0f172a]">
                    {cfg.qtyLabel} <span className="text-[#ef4444]">*</span>
                  </label>
                  <span className="text-xs font-medium text-[#94a3b8]">đơn vị tùy hàng hóa</span>
                </div>
                <div className="inline-flex w-[200px] max-w-full items-stretch overflow-hidden rounded-xl border border-[#d6dae4] bg-white transition hover:border-[#b9c0cd] focus-within:border-[#2563eb] focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.15)]">
                  <button
                    type="button"
                    onClick={() => updateQty(qtyNum - 1)}
                    className="grid w-[42px] place-items-center text-[#64748b] transition hover:bg-[#f7f8fb] hover:text-[#0f172a] active:bg-[#eef0f5]"
                    aria-label="Giảm"
                  >
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <input
                    id="transaction-qty"
                    type="number"
                    min={txType === "adj" ? 0 : 0.01}
                    step={0.01}
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-center text-base font-bold text-[#0f172a] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateQty(qtyNum + 1)}
                    className="grid w-[42px] place-items-center text-[#64748b] transition hover:bg-[#f7f8fb] hover:text-[#0f172a] active:bg-[#eef0f5]"
                    aria-label="Tăng"
                  >
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="mb-[18px]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="transaction-note" className="text-[13px] font-semibold text-[#0f172a]">
                    Ghi chú <span className="text-[#ef4444]">*</span>
                  </label>
                  <span className="text-xs font-medium text-[#94a3b8]">{note.length} / {NOTE_MAX_LENGTH}</span>
                </div>
                <textarea
                  id="transaction-note"
                  rows={4}
                  value={note}
                  maxLength={NOTE_MAX_LENGTH}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[92px] w-full resize-y rounded-xl border border-[#d6dae4] bg-white px-3.5 py-[11px] text-sm leading-[1.55] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] hover:border-[#b9c0cd] focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                  placeholder={txType === "adj" ? "Lý do điều chỉnh tồn kho" : "Lý do xuất/nhập, số chứng từ, người nhận..."}
                />
              </div>
            </div>

            <div className="mt-[26px] flex gap-2.5 border-t border-[#e6e9f0] pt-[22px]">
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="flex flex-1 items-center justify-center rounded-xl border border-[#2563eb] bg-[#2563eb] px-[18px] py-[11px] text-sm font-semibold text-white shadow-[0_6px_14px_-8px_#2563eb,inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-[#1d4ed8] hover:bg-[#1d4ed8] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Đang xử lý..." : "Xác nhận"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[#d6dae4] bg-white px-[18px] py-[11px] text-sm font-semibold text-[#0f172a] transition hover:border-[#b9c0cd] hover:bg-[#f7f8fb] active:scale-[0.985]"
              >
                Làm mới
              </button>
            </div>

            <div className="mt-[22px]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 flex items-center gap-2 text-[13px] font-bold text-[#0f172a]">
                  Giao dịch gần nhất
                  <span className="rounded-full bg-[#eff4ff] px-2 py-0.5 text-[11px] font-bold text-[#1d4ed8]">3</span>
                </h2>
                {selectedItem && (
                  <span className="min-w-0 text-right text-xs font-medium leading-snug text-[#94a3b8]">{selectedItem.code} · {selectedItem.name}</span>
                )}
              </div>

              {!selectedItem ? (
                <div className="rounded-xl border border-dashed border-[#d6dae4] bg-[#f7f8fb] px-3 py-[22px] text-center text-[13px] font-medium text-[#64748b]">
                  Chọn hàng hóa để xem giao dịch gần nhất
                </div>
              ) : (
                <div>
                  <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f8fb] p-1">
                    {(["stock", "adjustment"] as RecentTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setRecentTab(tab)}
                        className={cn(
                          "rounded-lg px-2.5 py-2 text-xs font-bold transition",
                          recentTab === tab
                            ? "bg-white text-[#1d4ed8] shadow-sm"
                            : "text-[#64748b] hover:bg-white/70 hover:text-[#0f172a]"
                        )}
                      >
                        {RECENT_TAB_LABEL[tab]}
                      </button>
                    ))}
                  </div>

                  {recentLoading ? (
                    <div className="rounded-xl border border-[#e6e9f0] bg-[#f7f8fb] px-3 py-[22px] text-center text-[13px] font-medium text-[#64748b]">
                      Đang tải giao dịch...
                    </div>
                  ) : recentError ? (
                    <Alert type="error" message={recentError} />
                  ) : activeRecentTxs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#d6dae4] bg-[#f7f8fb] px-3 py-[22px] text-center text-[13px] font-medium text-[#64748b]">
                      Chưa có giao dịch nào cho hàng hóa này
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-[#e6e9f0] bg-white">
                      <div className="grid grid-cols-[minmax(0,1fr)_48px_68px] gap-2 border-b border-[#eef0f5] bg-[#f7f8fb] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#64748b] sm:grid-cols-[minmax(0,1fr)_72px_86px]">
                        <div>Transaction</div>
                        <div className="text-right">{recentTab === "stock" ? "Qty" : "Before"}</div>
                        <div className="text-right">{recentTab === "stock" ? "Balance" : "After"}</div>
                      </div>
                      <div className="divide-y divide-[#eef0f5]">
                        {activeRecentTxs.map((tx) => {
                          const stockAfter = getStockAfter(tx);
                          return (
                            <div key={tx.id} className="grid grid-cols-[minmax(0,1fr)_48px_68px] gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_72px_86px]">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant={tx.type}>{TYPE_LABEL[tx.type]}</Badge>
                                  <span className="text-xs font-medium text-[#94a3b8]">
                                    {new Date(tx.createdAt).toLocaleString("vi-VN")}
                                  </span>
                                </div>
                                <div className="mt-1 whitespace-normal break-words text-xs font-medium leading-snug text-[#64748b]">
                                  {tx.user?.name ?? "Không rõ người dùng"}{tx.note ? ` · ${tx.note}` : ""}
                                </div>
                              </div>
                              <div className={cn("self-center text-right font-mono text-sm font-semibold", TYPE_TEXT[tx.type])}>
                                {recentTab === "stock"
                                  ? `${tx.type === "in" ? "+" : "-"}${tx.qty}`
                                  : tx.stockBefore ?? "-"}
                              </div>
                              <div className="self-center text-right font-mono text-sm font-semibold text-[#0f172a]">
                                {stockAfter ?? "-"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
