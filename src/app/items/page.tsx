// src/app/items/page.tsx
"use client";
import { Fragment, useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { useAppStore } from "@/store";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Badge, Modal, Alert } from "@/components/ui";
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

function getCategoryLabel(category: ApiCategory) {
  return `${category.code} - ${category.name}`;
}

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

  const handleItemRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, item: ApiItem) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleItemTransactions(item);
  };

  return (
    <AppShell title="Hàng hóa">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#aab]">🔍</span>
          <input
            className="w-full rounded-lg border border-[#dde1ea] bg-white py-2 pl-8 pr-3 text-[13px] text-[#1a1a2e] outline-none transition-colors placeholder:text-[#aab] focus:border-[#185FA5]"
            placeholder="Tìm theo tên hoặc mã hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {can("create_items") && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-0 bg-[#185FA5] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0e4a86]"
          >
            ＋ Thêm hàng
          </button>
        )}
      </div>

      {pageError && <div className="mb-4"><Alert type="error" message={pageError} /></div>}

      {loading ? (
        <div className="text-center text-gray-400 py-8 text-sm">Đang tải...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e9f0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Mã hàng</th>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Tên hàng</th>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Tồn kho</th>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Đơn giá (₫)</th>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Thành tiền (₫)</th>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const low = i.qty < i.minQty;
                  const expanded = expandedItemId === i.id;
                  const recentTxs = recentTxsByItem[i.id] ?? [];
                  const recentError = recentErrorByItem[i.id];
                  return (
                    <Fragment key={i.id}>
                      <tr
                        className="cursor-pointer border-b border-[#f0f2f6] transition-colors hover:bg-[#f6f9ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#185FA5]"
                        onClick={() => toggleItemTransactions(i)}
                        onKeyDown={(event) => handleItemRowKeyDown(event, i)}
                        tabIndex={0}
                        role="button"
                        aria-expanded={expanded}
                        aria-label={`Xem 5 giao dịch gần nhất của ${i.code} - ${i.name}`}
                      >
                        <td className="px-3.5 py-2.5 align-middle">
                          <Badge variant={i.category.code} className="font-bold tracking-wide">{i.code}</Badge>
                        </td>
                        <td className="px-3.5 py-2.5 align-middle">
                          <div className="font-semibold text-[#1a1a2e]">{i.name}</div>
                          <div className="mt-0.5 text-[11px] text-[#aab]">{i.category.name}</div>
                        </td>
                        <td className="px-3.5 py-2.5 align-middle">
                          <span className={low ? "font-bold text-[#c0392b]" : "font-semibold text-[#1a1a2e]"}>
                            {i.qty} {i.unit}{low ? " ⚠" : ""}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 align-middle font-medium text-[#374151]">{fmtCurrency(i.unitPrice)}</td>
                        <td className="px-3.5 py-2.5 align-middle font-bold text-[#1a1a2e]">{fmtCurrency(i.qty * i.unitPrice)}</td>
                        <td className="px-3.5 py-2.5 align-middle">
                          <div className="flex gap-1 whitespace-nowrap">
                            <button
                              type="button"
                              className="rounded-md border border-[#dde1ea] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#555] transition hover:bg-[#f0f2f6]"
                              onClick={(e) => { e.stopPropagation(); setModal({ type: "qr", item: i }); }}
                            >
                              QR
                            </button>
                            {can("edit_items") && (
                              <button
                                type="button"
                                className="rounded-md border border-[#185FA5] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#185FA5] transition hover:bg-[#ebf3fb]"
                                onClick={(e) => { e.stopPropagation(); openEdit(i); }}
                              >
                                Sửa
                              </button>
                            )}
                            {can("delete_items") && (
                              <button
                                type="button"
                                className="rounded-md border border-[#c0392b] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#c0392b] transition hover:bg-[#fdf0ee]"
                                onClick={(e) => { e.stopPropagation(); handleDelete(i.id, i.code); }}
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={6} className="border-b border-[#f0f2f6] bg-[#f8f9fc] px-3.5 py-3">
                            <div className="mb-2 text-xs font-semibold text-[#555]">5 giao dịch gần nhất</div>
                            {recentLoadingId === i.id ? (
                              <div className="text-sm text-[#8892a4]">Đang tải giao dịch...</div>
                            ) : recentError ? (
                              <Alert type="error" message={recentError} />
                            ) : recentTxs.length === 0 ? (
                              <div className="rounded-md border border-dashed border-[#dde1ea] bg-white px-3 py-3 text-center text-sm text-[#aab]">
                                Chưa có giao dịch nào cho hàng hóa này
                              </div>
                            ) : (
                              <div className="divide-y divide-[#f0f2f6] rounded-md border border-[#e5e9f0] bg-white">
                                {recentTxs.map((tx) => (
                                  <div key={tx.id} className="flex items-start justify-between gap-3 px-3 py-2">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge variant={tx.type}>{TYPE_LABEL[tx.type]}</Badge>
                                        <span className="text-xs text-[#8892a4]">
                                          {new Date(tx.createdAt).toLocaleString("vi-VN")}
                                        </span>
                                      </div>
                                      <div className="mt-1 whitespace-normal break-words text-xs text-[#555]">
                                        {tx.user?.name ?? "Không rõ người dùng"}{tx.note ? ` · ${tx.note}` : ""}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <div className={`font-mono text-sm font-semibold ${TYPE_COLOR[tx.type]}`}>
                                        {tx.type === "in" ? "+" : tx.type === "out" ? "-" : "="}{tx.qty}
                                      </div>
                                      <div className="mt-0.5 text-xs text-[#8892a4]">{fmtCurrency(tx.totalPrice)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && !loading && (
            <div className="px-4 py-10 text-center text-[13px] text-[#aab]">Không tìm thấy hàng hóa phù hợp.</div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal.type === "add" || modal.type === "edit") && (
        <Modal
          title={modal.type === "add" ? "Thêm hàng hóa" : "Sửa hàng hóa"}
          onClose={() => setModal({ type: "none" })}
          footer={<>
            <button
              type="button"
              onClick={() => setModal({ type: "none" })}
              className="rounded-lg border border-[#dde1ea] bg-white px-4 py-2 text-[13px] font-semibold text-[#555] transition hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={saveItem}
              disabled={saving}
              className="rounded-lg border-0 bg-[#185FA5] px-[18px] py-2 text-[13px] font-bold text-white transition hover:bg-[#0e4a86] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : modal.type === "add" ? "Lưu" : "Cập nhật"}
            </button>
          </>}
        >
          {formError && <div className="mb-4"><Alert type="error" message={formError} /></div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Mã hàng *</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={4}
                pattern="[A-Z][0-9]{3}"
                placeholder="Ví dụ: N123"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Loại hàng *</label>
              <select
                className="w-full rounded-lg border border-[#dde1ea] bg-white px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: parseInt(e.target.value) })}
                required
              >
                <option value={0}>-- Chọn danh mục --</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{getCategoryLabel(c)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Tên hàng *</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tên đầy đủ của hàng hóa"
              />
            </div>
            {modal.type === "add" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#555]">Số tồn đầu tiên</label>
                <input
                  className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                  type="number"
                  min={0}
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Đơn vị</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Đơn giá (₫)</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                type="number"
                min={0}
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Ngưỡng cảnh báo</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                type="number"
                min={0}
                value={form.minQty}
                onChange={(e) => setForm({ ...form, minQty: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
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
