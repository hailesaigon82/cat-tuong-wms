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
  description?: string;
}

export interface ApiItem {
  id: number;
  categoryId: number;
  name: string;
  code: string;
  unit: string;
  qty: number;
  unitPrice: number;
  minQty: number;
  isActive: boolean;
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
  unitPrice: number;
  totalPrice: number;
  note?: string;
  createdAt: string;
  item: ApiItem;
  user: Pick<ApiUser, "id" | "name" | "username">;
  newQty?: number;
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
  totalInventoryValue: number;
  todayTransactions: number;
  lowStockCount: number;
  lowStockItems: ApiItem[];
}
