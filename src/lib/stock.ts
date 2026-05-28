import type { ApiItem, ApiTransaction } from "@/types/api";

export function isStockHidden(source?: Pick<ApiItem, "stockHidden" | "qty"> | Pick<ApiTransaction, "stockHidden"> | null) {
  if (!source) return false;
  if ("stockHidden" in source && source.stockHidden === true) return true;
  return "qty" in source && source.qty === null;
}

export function formatStockQty(value: number | null | undefined, unit?: string, hidden?: boolean) {
  if (hidden || value === null || value === undefined) return "NA";
  const formatted = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.round((value + Number.EPSILON) * 100) / 100);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function stockSortValue(value: number | null | undefined, direction: "asc" | "desc") {
  if (value === null || value === undefined) return direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return value;
}
