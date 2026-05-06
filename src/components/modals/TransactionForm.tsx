// src/components/modals/TransactionForm.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Alert, Badge, Card, FormGroup, Input, Textarea } from "@/components/ui";
import { QRScanner } from "@/components/qr/QRScanner";
import { api, ApiError } from "@/lib/api";
import { cn, fmtCurrency } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, Minus, Plus, QrCode } from "lucide-react";
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
  const [recentTxs, setRecentTxs] = useState<ApiTransaction[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");
  const debouncedItemSearch = useDebounce(itemSearch, 300);

  const cfg = allowTypeSwitch ? { title: "Xuất Nhập", qtyLabel: "Số lượng" } : CONFIG[txType];
  const qtyNum = Number(qty);
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
      setItemSearch(getItemLabel(item));
      setItemDropdownOpen(false);
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
        setItemSearch(getItemLabel(matchedItem));
        setItemDropdownOpen(false);
        setShowScanner(false);
        setAlert(null);
      } catch (e) {
        setAlert({ msg: e instanceof ApiError ? e.message : "Không tìm thấy hàng hóa hoặc bạn không có quyền truy cập", type: "error" });
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
    if (!selectedItem) { setAlert({ msg: "Vui lòng chọn hàng hóa", type: "error" }); return; }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) { setAlert({ msg: "Vui lòng nhập số lượng lớn hơn 0", type: "error" }); return; }
    if (!Number.isInteger(qtyNum)) { setAlert({ msg: "Số lượng phải là số nguyên", type: "error" }); return; }
    if (txType === "out" && qtyNum > selectedItem.qty) {
      setAlert({
        msg: `Số lượng xuất (${qtyNum} ${selectedItem.unit}) vượt quá tồn kho hiện tại (${selectedItem.qty} ${selectedItem.unit})`,
        type: "error",
      });
      return;
    }
    if (!note.trim()) { setAlert({ msg: "Vui lòng nhập ghi chú", type: "error" }); return; }
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
      setItemSearch(getItemLabel(updatedItem));
      setItems((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
      await loadRecentTransactions(selectedItem.id);
      setQty("1"); setNote("");
    } catch (e) {
      setAlert({ msg: getTransactionErrorMessage(e, txType), type: "error" });
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
    setItemDropdownOpen(false);
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
                  <div className="relative">
                    <Input
                      value={itemSearch}
                      onChange={(e) => handleItemSearchChange(e.target.value)}
                      onFocus={() => setItemDropdownOpen(true)}
                      onBlur={() => window.setTimeout(() => setItemDropdownOpen(false), 120)}
                      placeholder="Gõ mã hoặc tên hàng hóa..."
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={itemDropdownOpen}
                      className={cn(
                        "pr-10 border-[#b8c2cc] bg-white shadow-sm",
                        itemDropdownOpen && "border-[#185FA5] ring-2 ring-[#185FA5]/15"
                      )}
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setItemDropdownOpen((open) => !open)}
                      className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                      aria-label="Mở danh sách hàng hóa"
                    >
                      <ChevronDown size={16} />
                    </button>

                    {itemDropdownOpen && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#9aa8b5] bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
                        {itemsLoading ? (
                          <div className="px-3 py-2 text-sm text-gray-400">Đang tải hàng hóa...</div>
                        ) : items.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">Không có kết quả</div>
                        ) : (
                          items.map((i) => (
                            <button
                              key={i.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectItem(i)}
                              className={cn(
                                "flex w-full border-b border-gray-100 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-[#eef5fb]",
                                itemId === i.id && "bg-[#e6f0fa]"
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-gray-800">{i.code} - {i.name}</span>
                                <span className="block truncate text-xs text-gray-400">{i.category.code} · {i.category.name}</span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </FormGroup>
              </div>

              <div className="mb-[18px]">
                <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
                  <label className="text-xs font-medium text-gray-600">Tồn kho</label>
                  <Input
                    value={selectedItem ? `${selectedItem.qty} ${selectedItem.unit}` : ""}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Chọn hàng hóa để xem tồn kho"
                  />
                </div>
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
                <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
                  <label className="text-xs font-medium text-gray-600">
                    {cfg.qtyLabel} <span className="text-red-500">*</span>
                  </label>
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
                </div>
              </div>

              <div className="mb-[18px]">
                <FormGroup label="Ghi chú" required>
                  <Textarea
                    rows={4} value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[90px] resize-y border-[#b8c2cc] bg-white shadow-sm focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/15"
                    placeholder={txType === "adj" ? "Lý do điều chỉnh tồn kho" : "Ghi chú cho phiếu xuất/nhập"}
                  />
                </FormGroup>
              </div>
            </div>

            <div className="mt-[22px] flex gap-2.5">
              <Button variant="primary" onClick={submit} disabled={saving}>
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
