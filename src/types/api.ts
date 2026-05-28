// src/types/api.ts
// Types khớp với response của Fastify backend

export interface ApiRole {
  id: number;
  code: string;
  name: string;
}

export interface ApiUser {
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  role: ApiRole;
  createdAt?: string;
}

export type AuthUser = ApiUser & {
  permissions: string[];
  allowedCategoryIds: number[];
};

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface ApiCategory {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ApiItem {
  id: number;
  categoryId: number;
  name: string;
  code: string;
  unit: string;
  qty: number | null;
  unitPrice: number;
  minQty: number | null;
  numOfTrans: number;
  isActive: boolean;
  stockHidden?: boolean;
  category: ApiCategory;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = "in" | "out" | "adj";

export interface ApiTransaction {
  id: number;
  itemId: number;
  userId: number;
  type: TransactionType;
  qty: number;
  stockBefore: number | null;
  stockHidden?: boolean;
  unitPrice: number;
  totalPrice: number;
  note?: string;
  reversedTransactionId?: number | null;
  createdAt: string;
  item: ApiItem;
  user: Pick<ApiUser, "id" | "name"> & { username?: string };
  newQty?: number | null;
}

export interface TransactionListResponse {
  data: ApiTransaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DashboardSummary {
  totalItems: number;
  totalInventoryValue: number | null;
  todayTransactions: number;
  lowStockCount: number;
  lowStockItems: ApiItem[];
  stockHidden?: boolean;
}

export interface SettingsResponse {
  hideStock: {
    enabled: boolean;
  };
}
