// src/app/items/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Badge, Card, Modal, FormGroup, Input, Select, Alert } from "@/components/ui";
import { QRGenerator } from "@/components/qr/QRGenerator";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { ApiItem, ApiCategory, ApiTransaction, TransactionListResponse } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { in: "Nhập kho", out: "Xuất kho", adj: "Điều chỉnh" };
const TYPE_COLOR: Record<string, string> = {
  in: "text-green-600",
  out: "text-red-600",
  adj: "text-amber-600",
};
const ITEM_CODE_PATTERN = /^[A-Z][0-9]{3}$/;

type ModalState =
  | { type: "none" }
  | { type: "add" }
  | { type: "edit"; item: ApiItem }
  | { type: "qr"; item: ApiItem };

export default function ItemsPage() {
  const can = useAppStore((s) => s.can);
  const [items, setItems]           = useState<ApiItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState("");
  const [modal, setModal]           = useState<ModalState>({ type: "none" });
  const [formError, setFormError]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [recentTxsByItem, setRecentTxsByItem] = useState<Record<number, ApiTransaction[]>>({});
  const [recentLoadingId, setRecentLoadingId] = useState<number | null>(null);
  const [recentErrorByItem, setRecentErrorByItem] = useState<Record<number, string>>({});
  const [form, setForm]             = useState({
    categoryId: 0, name: "", code: "", unit: "kg", qty: 0, unitPrice: 0, minQty: 5,
  });

  const loadItems = useCallback(async () => {
    try {
      const data = await api.get<ApiItem[]>("/items");
      setItems(data);
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Không thể tải danh sách hàng hóa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    api.get<ApiCategory[]>("/items/categories?action=create").then(setCategories).catch(() => {});
  }, [loadItems]);

  const filtered = items.filter(
    (i) => i.name.toLowerCase().includes(search.toLowerCase()) ||
           i.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    const defaultCategory = categories.find((category) => category.code === "N") ?? categories[0];
    setForm({ categoryId: defaultCategory?.id ?? 0, name: "", code: "", unit: "kg", qty: 0, unitPrice: 0, minQty: 5 });
    setFormError("");
    setModal({ type: "add" });
  };

  const openEdit = (item: ApiItem) => {
    setForm({ categoryId: item.categoryId, name: item.name, code: item.code, unit: item.unit, qty: item.qty, unitPrice: item.unitPrice, minQty: item.minQty });
    setFormError("");
    setModal({ type: "edit", item });
  };

  const saveItem = async () => {
    if (!form.name.trim() || !form.code.trim()) { setFormError("Vui lòng nhập tên và mã hàng"); return; }
    if ((modal.type === "add" || modal.type === "edit") && !ITEM_CODE_PATTERN.test(form.code.trim().toUpperCase())) {
      setFormError("Mã hàng phải gồm 1 chữ cái và 3 số, ví dụ N123 hoặc R001");
      return;
    }
    if ((modal.type === "add" || modal.type === "edit") && !form.categoryId) { setFormError("Vui lòng chọn danh mục"); return; }
    if (modal.type === "add" || modal.type === "edit") {
      const selectedCategory = categories.find((category) => category.id === form.categoryId);
      const normalizedCode = form.code.trim().toUpperCase();
      if (selectedCategory && normalizedCode[0] !== selectedCategory.code.toUpperCase()) {
        setFormError(`Mã hàng phải bắt đầu bằng mã danh mục ${selectedCategory.code}, ví dụ ${selectedCategory.code}123`);
        return;
      }
    }
    setSaving(true); setFormError("");
    try {
      if (modal.type === "edit") {
        await api.put(`/items/${modal.item.id}`, {
          categoryId: form.categoryId,
          name: form.name,
          code: form.code.trim().toUpperCase(),
          unit: form.unit,
          qty: form.qty,
          unitPrice: form.unitPrice,
          minQty: form.minQty,
        });
      } else {
        await api.post("/items", { ...form, code: form.code.trim().toUpperCase() });
      }
      await loadItems();
      setModal({ type: "none" });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Xóa hàng hóa ${code}?`)) return;
    try { await api.delete(`/items/${id}`); await loadItems(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Xóa thất bại"); }
  };

  const toggleItemTransactions = async (item: ApiItem) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      return;
    }

    setExpandedItemId(item.id);
    if (recentTxsByItem[item.id] || recentLoadingId === item.id) return;

    setRecentLoadingId(item.id);
    setRecentErrorByItem((current) => ({ ...current, [item.id]: "" }));
    try {
      const res = await api.get<TransactionListResponse>(
        `/transactions?limit=5&page=1&itemId=${item.id}`
      );
      setRecentTxsByItem((current) => ({ ...current, [item.id]: res.data }));
    } catch (e) {
      setRecentErrorByItem((current) => ({
        ...current,
        [item.id]: e instanceof ApiError ? e.message : "Không thể tải giao dịch gần nhất",
      }));
    } finally {
      setRecentLoadingId(null);
    }
  };

  return (
    <AppShell title="Hàng hóa">
      <div className="flex gap-2 mb-4">
        <Input className="flex-1" placeholder="Tìm theo tên hoặc mã hàng..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {can("create_items") && (
          <Button variant="primary" size="sm" onClick={openAdd}>+ Thêm</Button>
        )}
      </div>

      {pageError && <div className="mb-4"><Alert type="error" message={pageError} /></div>}

      {loading ? (
        <div className="text-center text-gray-400 py-8 text-sm">Đang tải...</div>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((i) => {
            const low = i.qty < i.minQty;
            const expanded = expandedItemId === i.id;
            const recentTxs = recentTxsByItem[i.id] ?? [];
            const recentError = recentErrorByItem[i.id];
            return (
              <Card key={i.id} className="!mb-0">
                <div
                  className="cursor-pointer px-2.5 py-1.5 transition-colors hover:bg-gray-50"
                  onClick={() => toggleItemTransactions(i)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={i.category.code}>{i.code}</Badge>
                      <span className="text-sm font-medium text-gray-800 truncate">{i.name}</span>
                      <span className="text-xs text-gray-400">{expanded ? "Thu gọn" : "Chi tiết"}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {/* Nút QR */}
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); setModal({ type: "qr", item: i }); }}>
                        QR
                      </Button>
                      {can("edit_items") && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); openEdit(i); }}>Sửa</Button>
                      )}
                      {can("delete_items") && (
                        <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleDelete(i.id, i.code); }}>Xóa</Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-0.5 grid grid-cols-3 gap-2 text-xs leading-tight text-gray-500">
                    <div>
                      <div className="text-gray-400">Tồn kho</div>
                      <div className={`font-semibold ${low ? "text-[#A32D2D]" : "text-gray-800"}`}>
                        {i.qty} {i.unit}{low ? " ⚠️" : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Đơn giá</div>
                      <div className="font-semibold text-gray-800">{fmtCurrency(i.unitPrice)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Thành tiền</div>
                      <div className="font-semibold text-gray-800">{fmtCurrency(i.qty * i.unitPrice)}</div>
                    </div>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
                    <div className="mb-2 text-xs font-semibold text-gray-600">5 giao dịch gần nhất</div>
                    {recentLoadingId === i.id ? (
                      <div className="text-sm text-gray-400">Đang tải giao dịch...</div>
                    ) : recentError ? (
                      <Alert type="error" message={recentError} />
                    ) : recentTxs.length === 0 ? (
                      <div className="rounded-md border border-dashed border-gray-200 bg-white px-3 py-3 text-center text-sm text-gray-400">
                        Chưa có giao dịch nào cho hàng hóa này
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
                        {recentTxs.map((tx) => (
                          <div key={tx.id} className="flex items-start justify-between gap-3 px-3 py-2">
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
                            <div className="shrink-0 text-right">
                              <div className={`font-mono text-sm font-semibold ${TYPE_COLOR[tx.type]}`}>
                                {tx.type === "in" ? "+" : tx.type === "out" ? "-" : "="}{tx.qty}
                              </div>
                              <div className="mt-0.5 text-xs text-gray-400">{fmtCurrency(tx.totalPrice)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div className="text-center text-gray-400 py-8 text-sm">Không có hàng hóa nào</div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal.type === "add" || modal.type === "edit") && (
        <Modal
          title={modal.type === "add" ? "Thêm hàng hóa mới" : "Chỉnh sửa hàng hóa"}
          onClose={() => setModal({ type: "none" })}
          footer={<>
            <Button onClick={() => setModal({ type: "none" })}>Hủy</Button>
            <Button variant="primary" onClick={saveItem} disabled={saving}>
              {saving ? "Đang lưu..." : modal.type === "add" ? "Lưu" : "Cập nhật"}
            </Button>
          </>}
        >
          {formError && <div className="mb-4"><Alert type="error" message={formError} /></div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormGroup label="Tên hàng hóa" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FormGroup>
            </div>
            <>
              <FormGroup label="Danh mục">
                <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: parseInt(e.target.value) })} required>
                  <option value={0}>-- Chọn danh mục --</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </Select>
              </FormGroup>
              <FormGroup label="Mã hàng" required>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  maxLength={4}
                  pattern="[A-Z][0-9]{3}"
                  placeholder="Vd: N123, R001"
                />
              </FormGroup>
            </>
            <FormGroup label="Đơn vị tính">
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </FormGroup>
            <FormGroup label="Đơn giá (VNĐ)">
              <Input type="number" min={0} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: parseInt(e.target.value) || 0 })} />
            </FormGroup>
            <FormGroup label="Tồn kho tối thiểu">
              <Input type="number" min={0} value={form.minQty} onChange={(e) => setForm({ ...form, minQty: parseInt(e.target.value) || 0 })} />
            </FormGroup>
            <FormGroup label={modal.type === "add" ? "Số lượng ban đầu" : "Số lượng tồn kho"}>
              <Input type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) || 0 })} />
            </FormGroup>
          </div>
        </Modal>
      )}

      {/* QR Modal */}
      {modal.type === "qr" && (
        <Modal
          title={`Mã QR — ${modal.item.code}`}
          onClose={() => setModal({ type: "none" })}
          footer={<Button onClick={() => setModal({ type: "none" })}>Đóng</Button>}
        >
          <div className="flex flex-col items-center gap-4 py-3">
            <QRGenerator text={modal.item.code} size={200} />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{modal.item.name}</p>
              <p className="text-xs text-gray-400 mt-1 font-mono">{modal.item.code}</p>
              <p className="text-xs text-gray-400 mt-0.5">{modal.item.category.name}</p>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Scan mã này khi nhập/xuất kho để tự chọn hàng hóa
            </p>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
