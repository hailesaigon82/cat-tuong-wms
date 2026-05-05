// src/components/modals/TransactionForm.tsx
"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Alert, Card, FormGroup, Select, Input, Textarea } from "@/components/ui";
import { QRScanner } from "@/components/qr/QRScanner";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { ApiItem, TransactionType } from "@/types/api";

const CONFIG: Record<TransactionType, { title: string; qtyLabel: string }> = {
  in:  { title: "Nhập kho",           qtyLabel: "Số lượng nhập"           },
  out: { title: "Xuất kho",           qtyLabel: "Số lượng xuất"           },
  adj: { title: "Điều chỉnh tồn kho", qtyLabel: "Số lượng mới (chính xác)" },
};

export function TransactionForm({ type }: { type: TransactionType }) {
  const [items, setItems]       = useState<ApiItem[]>([]);
  const [itemId, setItemId]     = useState<number | "">("");
  const [qty, setQty]           = useState("");
  const [note, setNote]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [alert, setAlert]       = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const cfg = CONFIG[type];
  const selectedItem = items.find((i) => i.id === Number(itemId));

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
    const qtyNum = parseInt(qty) || 0;
    if (qtyNum <= 0) { setAlert({ msg: "Số lượng phải lớn hơn 0", type: "error" }); return; }
    setSaving(true); setAlert(null);
    try {
      const res = await api.post<{ newQty: number }>("/transactions", {
        itemId: selectedItem.id, type, qty: qtyNum,
        note: note.trim() || undefined,
      });
      setAlert({
        msg: `✅ ${cfg.title} thành công! Tồn kho mới: ${res.newQty} ${selectedItem.unit}`,
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
                <FormGroup label="Tồn kho hiện tại">
                  <Input value={`${selectedItem.qty} ${selectedItem.unit}`} readOnly className="bg-gray-50" />
                </FormGroup>
              )}

              <FormGroup label={cfg.qtyLabel} required>
                <Input
                  type="number" min={1} value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="Nhập số lượng"
                />
              </FormGroup>

              {selectedItem && qty && parseInt(qty) > 0 && (
                <>
                  <FormGroup label="Đơn giá">
                    <Input value={fmtCurrency(selectedItem.unitPrice)} readOnly className="bg-gray-50" />
                  </FormGroup>
                  <FormGroup label="Thành tiền">
                    <Input value={fmtCurrency((parseInt(qty) || 0) * selectedItem.unitPrice)} readOnly className="bg-gray-50" />
                  </FormGroup>
                </>
              )}

              <div className="col-span-2">
                <FormGroup
                  label={type === "adj" ? "Ghi chú (bắt buộc)" : "Ghi chú"}
                  required={type === "adj"}
                >
                  <Textarea
                    rows={2} value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={type === "adj" ? "Lý do điều chỉnh (bắt buộc)" : "Ghi chú (không bắt buộc)"}
                  />
                </FormGroup>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="primary" onClick={submit} disabled={saving || loading}>
                {saving ? "Đang xử lý..." : `Xác nhận ${cfg.title}`}
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
