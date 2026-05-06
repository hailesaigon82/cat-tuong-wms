// src/components/modals/TransactionForm.tsx
"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Alert, Card, FormGroup, Select, Input, Textarea } from "@/components/ui";
import { QRScanner } from "@/components/qr/QRScanner";
import { api, ApiError } from "@/lib/api";
import { cn, fmtCurrency } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ArrowDownToLine, ArrowUpFromLine, Minus, Plus } from "lucide-react";
import type { ApiItem, TransactionType } from "@/types/api";

const CONFIG: Record<TransactionType, { title: string; qtyLabel: string }> = {
  in:  { title: "Nhập kho",           qtyLabel: "Số lượng nhập"           },
  out: { title: "Xuất kho",           qtyLabel: "Số lượng xuất"           },
  adj: { title: "Điều chỉnh tồn kho", qtyLabel: "Số lượng mới (chính xác)" },
};

interface TransactionFormProps {
  type: TransactionType;
  allowTypeSwitch?: boolean;
}

export function TransactionForm({ type, allowTypeSwitch = false }: TransactionFormProps) {
  const can = useAppStore((s) => s.can);
  const [items, setItems]       = useState<ApiItem[]>([]);
  const [itemId, setItemId]     = useState<number | "">("");
  const [txType, setTxType]     = useState<TransactionType>(type);
  const [qty, setQty]           = useState("");
  const [note, setNote]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [alert, setAlert]       = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const cfg = allowTypeSwitch ? { title: "Xuất Nhập", qtyLabel: "Số lượng" } : CONFIG[txType];
  const selectedItem = items.find((i) => i.id === Number(itemId));
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
    api.get<ApiItem[]>("/items")
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Xử lý khi scan QR hàng hóa
  // Hỗ trợ cả "ITEM-H0001" lẫn "H0001"
  const handleQRScan = (data: string) => {
    const code = data.startsWith("ITEM-") ? data.replace("ITEM-", "") : data;
    const item = items.find((i) => i.code.toUpperCase() === code.toUpperCase());
    if (item) {
      setItemId(item.id);
      setShowScanner(false);
      setAlert(null);
    } else {
      setAlert({ msg: `Không tìm thấy hàng hóa: ${code}`, type: "error" });
      setShowScanner(false);
    }
  };

  const submit = async () => {
    if (!selectedItem) { setAlert({ msg: "Vui lòng chọn hàng hóa", type: "error" }); return; }
    if (qtyNum <= 0) { setAlert({ msg: "Số lượng phải lớn hơn 0", type: "error" }); return; }
    if (!note.trim()) { setAlert({ msg: "Vui lòng nhập ghi chú", type: "error" }); return; }
    setSaving(true); setAlert(null);
    try {
      const res = await api.post<{ newQty: number }>("/transactions", {
        itemId: selectedItem.id, type: txType, qty: qtyNum,
        note: note.trim(),
      });
      setAlert({
        msg: `✅ ${CONFIG[txType].title} thành công! Tồn kho mới: ${res.newQty} ${selectedItem.unit}`,
        type: "success",
      });
      setItemId(""); setQty(""); setNote("");
      // Refresh danh sách để cập nhật qty
      const updated = await api.get<ApiItem[]>("/items");
      setItems(updated);
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

  return (
    <AppShell title={cfg.title}>
      <div className="max-w-xl">
        <Card>
          <div className="p-5">
            {alert && <div className="mb-4"><Alert type={alert.type} message={alert.msg} /></div>}

            {/* QR Scanner toggle */}
            <div className="flex items-center gap-3 mb-5">
              <Button onClick={() => setShowScanner(!showScanner)}>
                📷 Quét mã QR hàng hóa
              </Button>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FormGroup label="Hàng hóa" required>
                  <Select
                    value={itemId}
                    onChange={(e) => setItemId(Number(e.target.value) || "")}
                    disabled={loading}
                  >
                    <option value="">{loading ? "Đang tải..." : "-- Chọn hàng hóa --"}</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} — {i.name} (Tồn: {i.qty} {i.unit})
                      </option>
                    ))}
                  </Select>
                </FormGroup>
              </div>

              {selectedItem && (
                <div className="col-span-2 rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Quản lý kho</h2>
                    <p className="mt-1 text-xs text-gray-500">Chọn thao tác và nhập số lượng hàng hóa.</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Tồn hiện tại: <span className="font-medium text-gray-700">{selectedItem.qty} {selectedItem.unit}</span>
                    </p>
                  </div>

                  {allowTypeSwitch && (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => selectTxType("out")}
                        disabled={!canOut}
                        className={cn(
                          "flex h-[52px] items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                          txType === "out"
                            ? "border-[#A32D2D] bg-[#A32D2D] text-white"
                            : "border-red-500 bg-white text-red-600 hover:bg-red-50"
                        )}
                      >
                        <ArrowUpFromLine size={18} />
                        Xuất kho
                      </button>
                      <button
                        type="button"
                        onClick={() => selectTxType("in")}
                        disabled={!canIn}
                        className={cn(
                          "flex h-[52px] items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                          txType === "in"
                            ? "border-[#0F8A5F] bg-[#0F8A5F] text-white"
                            : "border-[#0F8A5F] bg-white text-[#0F8A5F] hover:bg-green-50"
                        )}
                      >
                        <ArrowDownToLine size={18} />
                        Nhập kho
                      </button>
                    </div>
                  )}

                  <div className="mt-4">
                    <FormGroup label={cfg.qtyLabel} required>
                      <div className="flex h-12 overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-[#185FA5]">
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          placeholder="Nhập số lượng"
                          className="min-w-0 flex-1 border-0 px-3 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(qtyNum - 1)}
                          className="flex w-10 items-center justify-center border-l border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          <Minus size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQty(qtyNum + 1)}
                          className="flex w-10 items-center justify-center border-l border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </FormGroup>
                  </div>
                </div>
              )}

              {selectedItem && qtyNum > 0 && (
                <>
                  <FormGroup label="Đơn giá">
                    <Input value={fmtCurrency(selectedItem.unitPrice)} readOnly className="bg-gray-50" />
                  </FormGroup>
                  <FormGroup label="Thành tiền">
                    <Input value={fmtCurrency(qtyNum * selectedItem.unitPrice)} readOnly className="bg-gray-50" />
                  </FormGroup>
                </>
              )}

              <div className="col-span-2">
                <FormGroup label="Ghi chú" required>
                  <Textarea
                    rows={2} value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={txType === "adj" ? "Lý do điều chỉnh tồn kho" : "Ghi chú cho phiếu xuất/nhập"}
                  />
                </FormGroup>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="primary" onClick={submit} disabled={saving || loading}>
                {saving ? "Đang xử lý..." : "Xác nhận"}
              </Button>
              <Button onClick={() => { setItemId(""); setQty(""); setNote(""); setAlert(null); }}>
                Làm mới
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
