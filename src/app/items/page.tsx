// src/app/items/page.tsx
"use client";
import { Fragment, useState, useEffect, useCallback, type FocusEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
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
const POPULAR_ITEMS_LIMIT = 30;
const POPULAR_CATEGORY_CODES = ["R", "N"];

function getCategoryLabel(category: ApiCategory) {
  return `${category.code} - ${category.name}`;
}

function parseDecimalInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDecimalInputAllowed(value: string) {
  return value === "" || /^\d+(\.\d{0,2})?$/.test(value);
}

function hasMaxTwoDecimals(value: number) {
  return Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}

function selectInputValue(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.select();
}

function formatQty(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type ModalState =
  | { type: "none" }
  | { type: "add" }
  | { type: "edit"; item: ApiItem }
  | { type: "qr"; item: ApiItem };

type SortKey = "code" | "name" | "qty";
type SortDirection = "asc" | "desc";
type ItemTab = "ingredients" | "invoices" | "popular";
type DisplayItem = ApiItem & { transactionCount?: number };

const SORT_LABEL: Record<SortKey, string> = {
  code: "Mã hàng",
  name: "Tên hàng",
  qty: "Tồn kho",
};

const ITEM_TABS: Array<{ key: ItemTab; label: string; categoryCodes?: string[] }> = [
  { key: "ingredients", label: "Kho Hương liệu", categoryCodes: ["R", "N"] },
  { key: "popular", label: "Hương liệu phổ biến" },
  { key: "invoices", label: "Hóa đơn", categoryCodes: ["H"] },
];

export default function ItemsPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const router = useRouter();
  const [items, setItems]           = useState<ApiItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [editCategories, setEditCategories] = useState<ApiCategory[]>([]);
  const [editCategoryIds, setEditCategoryIds] = useState<Set<number>>(new Set());
  const [deleteCategoryIds, setDeleteCategoryIds] = useState<Set<number>>(new Set());
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
  const [activeTab, setActiveTab] = useState<ItemTab>("ingredients");
  const [popularItems, setPopularItems] = useState<DisplayItem[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularError, setPopularError] = useState("");
  const [popularLoaded, setPopularLoaded] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "qty",
    direction: "asc",
  });
  const [form, setForm]             = useState({
    categoryId: 0, name: "", code: "", unit: "kg", qty: 0, unitPrice: 0, minQty: 5,
  });
  const permissions = currentUser?.permissions ?? [];
  const canCreateItems = permissions.includes("create_items");
  const canEditItems = permissions.includes("edit_items");
  const canDeleteItems = permissions.includes("delete_items");
  const canTxIn = permissions.includes("tx_in");
  const canTxOut = permissions.includes("tx_out");
  const canTxAdj = permissions.includes("tx_adj");
  const canViewHistory = permissions.includes("view_history");

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
    if (canEditItems) {
      api.get<ApiCategory[]>("/items/categories?action=edit")
        .then((data) => {
          setEditCategories(data);
          setEditCategoryIds(new Set(data.map((category) => category.id)));
        })
        .catch(() => {
          setEditCategories([]);
          setEditCategoryIds(new Set());
        });
    } else {
      setEditCategories([]);
      setEditCategoryIds(new Set());
    }
    if (canDeleteItems) {
      api.get<ApiCategory[]>("/items/categories?action=delete")
        .then((data) => setDeleteCategoryIds(new Set(data.map((category) => category.id))))
        .catch(() => setDeleteCategoryIds(new Set()));
    } else {
      setDeleteCategoryIds(new Set());
    }
  }, [canDeleteItems, canEditItems, loadItems]);

  const loadPopularItems = useCallback(async () => {
    if (!canViewHistory) {
      setPopularError("Bạn cần quyền xem lịch sử để xem Hương liệu phổ biến");
      setPopularLoaded(true);
      return;
    }

    setPopularLoading(true);
    setPopularError("");
    try {
      const data = await api.get<DisplayItem[]>(
        `/items/popular?limit=${POPULAR_ITEMS_LIMIT}&categoryCodes=${POPULAR_CATEGORY_CODES.join(",")}`
      );
      setPopularItems(data);
      setPopularLoaded(true);
    } catch (e) {
      setPopularError(e instanceof ApiError ? e.message : "Không thể tải Hương liệu phổ biến");
    } finally {
      setPopularLoading(false);
    }
  }, [canViewHistory]);

  useEffect(() => {
    if (activeTab !== "popular" || popularLoaded || popularLoading) return;
    loadPopularItems();
  }, [activeTab, loadPopularItems, popularLoaded, popularLoading]);

  const activeTabConfig = ITEM_TABS.find((tab) => tab.key === activeTab) ?? ITEM_TABS[0];
  const tabItems: DisplayItem[] = activeTab === "popular"
    ? popularItems
    : items.filter((item) =>
        activeTabConfig.categoryCodes?.includes(item.category.code.toUpperCase())
      );
  const tabCounts = ITEM_TABS.reduce<Record<ItemTab, number>>((counts, tab) => {
    counts[tab.key] = tab.key === "popular"
      ? popularItems.length
      : items.filter((item) =>
          tab.categoryCodes?.includes(item.category.code.toUpperCase())
        ).length;
    return counts;
  }, { ingredients: 0, invoices: 0, popular: 0 });
  const filtered = tabItems.filter(
    (i) => i.name.toLowerCase().includes(search.toLowerCase()) ||
           i.code.toLowerCase().includes(search.toLowerCase())
  );
  const sortedItems = activeTab === "popular" ? filtered : [...filtered].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "qty") {
      return (a.qty - b.qty) * direction;
    }
    return a[sort.key].localeCompare(b[sort.key], "vi", { numeric: true, sensitivity: "base" }) * direction;
  });
  const createCategoryCodes = activeTabConfig.categoryCodes ?? [];
  const createCategoriesForActiveTab = categories.filter((category) =>
    createCategoryCodes.includes(category.code.toUpperCase())
  );
  const canCreateInActiveTab = activeTab !== "popular" && canCreateItems && createCategoriesForActiveTab.length > 0;
  const modalCategories = modal.type === "edit" ? editCategories : createCategoriesForActiveTab;

  const openAdd = () => {
    const preferredCategoryCode = activeTab === "invoices" ? "H" : "N";
    const defaultCategory =
      createCategoriesForActiveTab.find((category) => category.code === preferredCategoryCode) ??
      createCategoriesForActiveTab[0];
    if (!defaultCategory) {
      setPageError("Bạn không có quyền thêm hàng hóa trong tab này");
      return;
    }
    setForm({ categoryId: defaultCategory.id, name: "", code: "", unit: "kg", qty: 0, unitPrice: 0, minQty: 5 });
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
    if (modal.type === "add" && !hasMaxTwoDecimals(form.qty)) { setFormError("Số tồn đầu tiên chỉ được nhập tối đa 2 chữ số thập phân"); return; }
    if (!hasMaxTwoDecimals(form.minQty)) { setFormError("Ngưỡng cảnh báo chỉ được nhập tối đa 2 chữ số thập phân"); return; }
    if (modal.type === "add" || modal.type === "edit") {
      const selectedCategory = modalCategories.find((category) => category.id === form.categoryId);
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
    if (!canViewHistory) return;
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

  const updateDecimalField = (field: "qty" | "minQty", value: string) => {
    if (!isDecimalInputAllowed(value)) return;
    setForm((current) => ({ ...current, [field]: parseDecimalInput(value) }));
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const openTransactionForItem = (path: string, itemCode: string) => {
    router.push(`${path}?item=${encodeURIComponent(itemCode)}`);
  };

  const renderSortableHeader = (key: SortKey) => {
    const active = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition hover:bg-[#eef3fb] hover:text-[#185FA5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#185FA5]"
      >
        <span>{SORT_LABEL[key]}</span>
        <span className={active ? "text-[#185FA5]" : "text-[#b5bdca]"} aria-hidden="true">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    );
  };

  return (
    <AppShell title="Hàng hóa">
      <div className="mb-3 inline-flex w-full rounded-xl border border-[#dde1ea] bg-white p-1 sm:w-auto">
        {ITEM_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setExpandedItemId(null);
              }}
              className={[
                "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition sm:flex-none",
                active ? "bg-[#185FA5] text-white shadow-sm" : "text-[#667085] hover:bg-[#f5f7fb] hover:text-[#185FA5]",
              ].join(" ")}
              aria-pressed={active}
            >
              <span>{tab.key === "popular" ? "Hương liệu phổ biến (T30)" : `${tab.label} ${tabCounts[tab.key]}`}</span>
            </button>
          );
        })}
      </div>

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
        {canCreateInActiveTab && (
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
      {activeTab === "popular" && popularError && (
        <div className="mb-4"><Alert type="error" message={popularError} /></div>
      )}

      {loading || (activeTab === "popular" && popularLoading) ? (
        <div className="text-center text-gray-400 py-8 text-sm">Đang tải...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e9f0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th aria-sort={sort.key === "code" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">{renderSortableHeader("code")}</th>
                  <th aria-sort={sort.key === "name" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">{renderSortableHeader("name")}</th>
                  <th aria-sort={sort.key === "qty" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">{renderSortableHeader("qty")}</th>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Đơn giá (₫)</th>
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Thành tiền (₫)</th>
                  {activeTab === "popular" && (
                    <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Số giao dịch</th>
                  )}
                  <th className="whitespace-nowrap border-b border-[#e5e9f0] bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8892a4]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((i) => {
                  const low = i.qty < i.minQty;
                  const expanded = expandedItemId === i.id;
                  const recentTxs = recentTxsByItem[i.id] ?? [];
                  const recentError = recentErrorByItem[i.id];
                  const canEditItem = canEditItems && editCategoryIds.has(i.categoryId);
                  const canDeleteItem = canDeleteItems && deleteCategoryIds.has(i.categoryId);
                  return (
                    <Fragment key={i.id}>
                      <tr
                        className={[
                          "border-b border-[#f0f2f6] transition-colors hover:bg-[#f6f9ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#185FA5]",
                          canViewHistory ? "cursor-pointer" : "",
                        ].join(" ")}
                        onClick={() => toggleItemTransactions(i)}
                        onKeyDown={(event) => handleItemRowKeyDown(event, i)}
                        tabIndex={canViewHistory ? 0 : undefined}
                        role={canViewHistory ? "button" : undefined}
                        aria-expanded={canViewHistory ? expanded : undefined}
                        aria-label={canViewHistory ? `Xem 5 giao dịch gần nhất của ${i.code} - ${i.name}` : undefined}
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
                            {formatQty(i.qty)} {i.unit}{low ? " ⚠" : ""}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 align-middle font-medium text-[#374151]">{fmtCurrency(i.unitPrice)}</td>
                        <td className="px-3.5 py-2.5 align-middle font-bold text-[#1a1a2e]">{fmtCurrency(i.qty * i.unitPrice)}</td>
                        {activeTab === "popular" && (
                          <td className="px-3.5 py-2.5 align-middle">
                            <span className="inline-flex rounded-full bg-[#eef3fb] px-2.5 py-1 text-xs font-bold text-[#185FA5]">
                              {i.transactionCount ?? 0}
                            </span>
                          </td>
                        )}
                        <td className="px-3.5 py-2.5 align-middle">
                          <div className="flex flex-wrap gap-1 whitespace-nowrap">
                            <button
                              type="button"
                              className="rounded-md border border-[#dde1ea] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#555] transition hover:bg-[#f0f2f6]"
                              onClick={(e) => { e.stopPropagation(); setModal({ type: "qr", item: i }); }}
                            >
                              QR
                            </button>
                            {(canTxIn || canTxOut) && (
                              <button
                                type="button"
                                className="rounded-md border border-[#059669] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#047857] transition hover:bg-[#ecfdf5]"
                                onClick={(e) => { e.stopPropagation(); openTransactionForItem("/transactions", i.code); }}
                              >
                                Xuất Nhập
                              </button>
                            )}
                            {canTxAdj && (
                              <button
                                type="button"
                                className="rounded-md border border-[#d97706] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#b45309] transition hover:bg-[#fffbeb]"
                                onClick={(e) => { e.stopPropagation(); openTransactionForItem("/transactions/adj", i.code); }}
                              >
                                Điều chỉnh
                              </button>
                            )}
                            {canEditItem && (
                              <button
                                type="button"
                                className="rounded-md border border-[#185FA5] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#185FA5] transition hover:bg-[#ebf3fb]"
                                onClick={(e) => { e.stopPropagation(); openEdit(i); }}
                              >
                                Sửa
                              </button>
                            )}
                            {canDeleteItem && (
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
                          <td colSpan={activeTab === "popular" ? 7 : 6} className="border-b border-[#f0f2f6] bg-[#f8f9fc] px-3.5 py-3">
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
                                        {tx.type === "in" ? "+" : tx.type === "out" ? "-" : "="}{formatQty(tx.qty)}
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
                onFocus={selectInputValue}
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
                {modalCategories.map((c) => <option key={c.id} value={c.id}>{getCategoryLabel(c)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Tên hàng *</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                value={form.name}
                onFocus={selectInputValue}
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
                  step={0.01}
                  value={form.qty}
                  onFocus={selectInputValue}
                  onChange={(e) => updateDecimalField("qty", e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Đơn vị</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                value={form.unit}
                onFocus={selectInputValue}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#555]">Đơn giá (₫)</label>
              <input
                className="w-full rounded-lg border border-[#dde1ea] px-3 py-2 text-[13px] outline-none transition focus:border-[#185FA5]"
                type="number"
                min={0}
                step={1}
                value={form.unitPrice}
                onFocus={selectInputValue}
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
                step={0.01}
                value={form.minQty}
                onFocus={selectInputValue}
                onChange={(e) => updateDecimalField("minQty", e.target.value)}
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
