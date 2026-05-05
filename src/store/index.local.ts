// src/store/index.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DBState, User, Item, Transaction, TransactionType, UserRole } from "@/types";

const INITIAL_DB: DBState = {
  users: [
    { id: 1, name: "Nguyễn Văn Admin", username: "admin", password: "admin123", role: 1, qr: "USER-admin" },
    { id: 2, name: "Trần Thị Quản Lý", username: "manager1", password: "mgr123", role: 2, qr: "USER-manager1" },
    { id: 3, name: "Lê Văn Văn Phòng", username: "office1", password: "off123", role: 3, qr: "USER-office1" },
    { id: 4, name: "Phạm Thị Kho", username: "wh1", password: "wh123", role: 4, qr: "USER-wh1" },
  ],
  items: [
    { id: 1, name: "Giá đỡ laptop", code: "H0001", category: "H", unit: "cái", qty: 25, unitPrice: 150000, minQty: 5 },
    { id: 2, name: "Thùng giấy A4", code: "H0002", category: "H", unit: "thùng", qty: 3, unitPrice: 85000, minQty: 10 },
    { id: 3, name: "Thanh thép 10mm", code: "R0001", category: "R", unit: "kg", qty: 200, unitPrice: 45000, minQty: 50 },
    { id: 4, name: "Ống nhựa PVC 1 inch", code: "R0002", category: "R", unit: "m", qty: 8, unitPrice: 32000, minQty: 20 },
    { id: 5, name: "Thành phẩm A", code: "N0001", category: "N", unit: "cái", qty: 50, unitPrice: 320000, minQty: 10 },
    { id: 6, name: "Thành phẩm B", code: "N0002", category: "N", unit: "cái", qty: 12, unitPrice: 480000, minQty: 15 },
  ],
  transactions: [
    { id: 1, itemId: 1, type: "in", qty: 10, unitPrice: 150000, note: "Nhập kho ban đầu", userId: 1, date: "2025-04-28 09:00" },
    { id: 2, itemId: 3, type: "in", qty: 100, userId: 2, unitPrice: 45000, note: "Đơn mua #001", date: "2025-04-29 10:30" },
    { id: 3, itemId: 5, type: "out", qty: 5, userId: 4, unitPrice: 320000, note: "Giao hàng khách", date: "2025-05-01 14:00" },
    { id: 4, itemId: 2, type: "out", qty: 7, userId: 4, unitPrice: 85000, note: "Sử dụng văn phòng", date: "2025-05-02 08:45" },
    { id: 5, itemId: 4, type: "out", qty: 12, userId: 2, unitPrice: 32000, note: "Dây chuyền sản xuất", date: "2025-05-03 11:20" },
  ],
  nextItemId: 7,
  nextTxId: 6,
  nextUserId: 5,
};

interface AppStore extends DBState {
  currentUser: User | null;
  // Auth
  login: (username: string, password: string) => boolean;
  loginByQR: (qrData: string) => boolean;
  logout: () => void;
  // Items
  addItem: (item: Omit<Item, "id">) => void;
  updateItem: (id: number, data: Partial<Item>) => void;
  deleteItem: (id: number) => void;
  // Transactions
  addTransaction: (tx: Omit<Transaction, "id" | "date">) => void;
  // Users
  addUser: (user: Omit<User, "id" | "qr">) => void;
  updateUser: (id: number, data: Partial<User>) => void;
  deleteUser: (id: number) => void;
  // Helpers
  visibleItems: () => Item[];
  can: (action: string) => boolean;
}

export const ROLE_NAMES: Record<UserRole, string> = {
  1: "Quản trị viên",
  2: "Quản lý",
  3: "Nhân viên văn phòng",
  4: "Nhân viên kho",
};

const PERMISSIONS: Record<string, UserRole[]> = {
  viewAllItems: [1, 2, 4],
  viewHItems: [3],
  addEditItems: [1, 2],
  txIn: [1, 2, 4],
  txOut: [1, 2, 4],
  txAdj: [1, 2],
  manageUsers: [1, 2],
  manageAdminUsers: [1],
  viewDashboard: [1, 2, 3, 4],
};

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_DB,
      currentUser: null,

      login: (username, password) => {
        const user = get().users.find(
          (u) => u.username === username && u.password === password
        );
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      loginByQR: (qrData) => {
        const username = qrData.replace("USER-", "");
        const user = get().users.find((u) => u.username === username);
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      addItem: (item) =>
        set((s) => ({
          items: [...s.items, { ...item, id: s.nextItemId }],
          nextItemId: s.nextItemId + 1,
        })),

      updateItem: (id, data) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...data } : i)),
        })),

      deleteItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      addTransaction: (tx) => {
        const { items, nextTxId } = get();
        const item = items.find((i) => i.id === tx.itemId);
        if (!item) return;
        const newTx: Transaction = {
          ...tx,
          id: nextTxId,
          date: fmtDate(new Date()),
        };
        let newQty = item.qty;
        if (tx.type === "in") newQty += tx.qty;
        else if (tx.type === "out") newQty -= tx.qty;
        else newQty = tx.qty;
        set((s) => ({
          transactions: [...s.transactions, newTx],
          nextTxId: s.nextTxId + 1,
          items: s.items.map((i) => (i.id === item.id ? { ...i, qty: newQty } : i)),
        }));
      },

      addUser: (userData) => {
        const { nextUserId } = get();
        const user: User = {
          ...userData,
          id: nextUserId,
          qr: `USER-${userData.username}`,
        };
        set((s) => ({
          users: [...s.users, user],
          nextUserId: s.nextUserId + 1,
        }));
      },

      updateUser: (id, data) =>
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id
              ? { ...u, ...data, qr: `USER-${data.username ?? u.username}` }
              : u
          ),
        })),

      deleteUser: (id) =>
        set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

      visibleItems: () => {
        const { currentUser, items } = get();
        if (currentUser?.role === 3) return items.filter((i) => i.category === "H");
        return items;
      },

      can: (action) => {
        const role = get().currentUser?.role;
        if (!role) return false;
        return PERMISSIONS[action]?.includes(role) ?? false;
      },
    }),
    {
      name: "cat-tuong-wms-storage",
      partialize: (state) => ({
        users: state.users,
        items: state.items,
        transactions: state.transactions,
        nextItemId: state.nextItemId,
        nextTxId: state.nextTxId,
        nextUserId: state.nextUserId,
      }),
    }
  )
);
