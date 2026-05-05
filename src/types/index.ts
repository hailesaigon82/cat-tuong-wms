// src/types/index.ts

export type UserRole = 1 | 2 | 3 | 4;

export interface User {
  id: number;
  name: string;
  username: string;
  password: string;
  role: UserRole;
  qr: string;
}

export interface Item {
  id: number;
  name: string;
  code: string;
  category: "N" | "R" | "H";
  unit: string;
  qty: number;
  unitPrice: number;
  minQty: number;
}

export type TransactionType = "in" | "out" | "adj";

export interface Transaction {
  id: number;
  itemId: number;
  type: TransactionType;
  qty: number;
  unitPrice: number;
  note: string;
  userId: number;
  date: string;
}

export interface DBState {
  users: User[];
  items: Item[];
  transactions: Transaction[];
  nextItemId: number;
  nextTxId: number;
  nextUserId: number;
}

export type NavPage =
  | "dashboard"
  | "items"
  | "tx-in"
  | "tx-out"
  | "tx-adj"
  | "history"
  | "users";

export interface NavItem {
  id: NavPage;
  label: string;
  icon: string;
  roles: UserRole[];
}
