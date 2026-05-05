// src/app/items/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Badge, Card, CardHeader, Table, Th, Td, Modal, FormGroup, Input, Select, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtCurrency } from "@/lib/utils";
import type { ApiItem, ApiCategory } from "@/types/api";

type ModalState = { type: "none" } | { type: "add" } | { type: "edit"; item: ApiItem };

export default function ItemsPage() {
  const can = useAppStore((s) => s.can);
  const [items, setItems]         = useState<ApiItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState("");
  const [modal, setModal]         = useState<ModalState>({ type: "none" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ categoryId: 1, name: "", code: "", unit: "cái", qty: 0, unitPrice: 0, minQty: 5 });

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
    // Load categories cho form
    api.get<ApiCategory[]>("/items/categories").then(setCategories).catch(() => {});
  }, [loadItems]);

  const filtered = items.filter(
    (i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm({ categoryId: categories[0]?.id ?? 1, name: "", code: "", unit: "cái", qty: 0, unitPrice: 0, minQty: 5 });
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
    setSaving(true); setFormError("");
    try {
      if (modal.type === "edit") {
        await api.put(`/items/${modal.item.id}`, { name: form.name, unit: form.unit, unitPrice: form.unitPrice, minQty: form.minQty });
      } else {
        await api.post("/items", form);
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
    if (!confirm(`Bạn có chắc muốn xóa hàng hóa ${code}?`)) return;
    try {
      await api.delete(`/items/${id}`);
      await loadItems();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Xóa thất bại");
    }
  };

  return (
    <AppShell title="Hàng hóa">
      <div className="flex gap-3 mb-4">
        <Input className="flex-1 max-w-sm" placeholder="Tìm theo tên hoặc mã hàng..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {can("create_items") && <Button variant="primary" onClick={openAdd}>+ Thêm hàng hóa</Button>}
      </div>

      {pageError && <div className="mb-4"><Alert type="error" message={pageError} /></div>}

      <Card>
        <CardHeader title={`Danh sách hàng hóa (${filtered.length})`} />
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <Table>
            <thead>
              <tr><Th>Mã hàng</Th><Th>Tên hàng</Th><Th>Danh mục</Th><Th>ĐVT</Th><Th>Tồn kho</Th><Th>Đơn giá</Th><Th>Thành tiền</Th>
                {(can("edit_items") || can("delete_items")) && <Th>Thao tác</Th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const low = i.qty < i.minQty;
                return (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <Td><Badge variant={i.category.code}>{i.code}</Badge></Td>
                    <Td>{i.name}</Td>
                    <Td><span className="text-xs text-gray-500">{i.category.name}</span></Td>
                    <Td>{i.unit}</Td>
                    <Td><span className={low ? "text-[#A32D2D] font-semibold" : ""}>{i.qty}{low ? " ⚠️" : ""}</span></Td>
                    <Td>{fmtCurrency(i.unitPrice)}</Td>
                    <Td>{fmtCurrency(i.qty * i.unitPrice)}</Td>
                    {(can("edit_items") || can("delete_items")) && (
                      <Td>
                        <div className="flex gap-1.5">
                          {can("edit_items") && <Button size="sm" onClick={() => openEdit(i)}>Sửa</Button>}
                          {can("delete_items") && <Button size="sm" variant="danger" onClick={() => handleDelete(i.id, i.code)}>Xóa</Button>}
                        </div>
                      </Td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr><td className="text-center text-gray-400 py-8 text-sm" colSpan={8}>Không có hàng hóa nào</td></tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>

      {(modal.type === "add" || modal.type === "edit") && (
        <Modal title={modal.type === "add" ? "Thêm hàng hóa mới" : "Chỉnh sửa hàng hóa"}
          onClose={() => setModal({ type: "none" })}
          footer={<>
            <Button onClick={() => setModal({ type: "none" })}>Hủy</Button>
            <Button variant="primary" onClick={saveItem} disabled={saving}>{saving ? "Đang lưu..." : modal.type === "add" ? "Lưu" : "Cập nhật"}</Button>
          </>}>
          {formError && <div className="mb-4"><Alert type="error" message={formError} /></div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormGroup label="Tên hàng hóa" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FormGroup>
            </div>
            {modal.type === "add" && <>
              <FormGroup label="Danh mục">
                <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: parseInt(e.target.value) })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </Select>
              </FormGroup>
              <FormGroup label="Mã hàng" required>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Vd: N0001" />
              </FormGroup>
            </>}
            <FormGroup label="Đơn vị tính">
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </FormGroup>
            <FormGroup label="Đơn giá (VNĐ)">
              <Input type="number" min={0} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: parseInt(e.target.value) || 0 })} />
            </FormGroup>
            <FormGroup label="Tồn kho tối thiểu">
              <Input type="number" min={0} value={form.minQty} onChange={(e) => setForm({ ...form, minQty: parseInt(e.target.value) || 0 })} />
            </FormGroup>
            {modal.type === "add" && (
              <FormGroup label="Số lượng ban đầu">
                <Input type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) || 0 })} />
              </FormGroup>
            )}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
