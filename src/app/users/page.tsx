// src/app/users/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAppStore, ROLE_NAMES } from "@/store";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Badge, Card, Modal, FormGroup, Input, Select, Alert } from "@/components/ui";
import { QRGenerator } from "@/components/qr/QRGenerator";
import { api, ApiError } from "@/lib/api";
import type { ApiUser } from "@/types/api";

type ModalState =
  | { type: "none" }
  | { type: "add" }
  | { type: "edit"; user: ApiUser }
  | { type: "qr"; user: ApiUser };

const ROLE_BADGE: Record<string, string> = {
  admin: "admin", manager: "manager", office: "office", warehouse: "warehouse",
};

export default function UsersPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdmin     = currentUser?.role.code === "admin";

  const [users, setUsers]         = useState<ApiUser[]>([]);
  const [roles, setRoles]         = useState<{ id: number; code: string; name: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState("");
  const [modal, setModal]         = useState<ModalState>({ type: "none" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ roleId: 4, name: "", username: "", password: "" });

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get<ApiUser[]>("/users");
      setUsers(data);
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    api.get<typeof roles>("/users/roles").then((data) => {
      setRoles(isAdmin ? data : data.filter((r) => r.code !== "admin"));
    }).catch(() => {});
  }, [loadUsers, isAdmin]);

  const openAdd = () => {
    setForm({ roleId: roles.find((r) => r.code === "warehouse")?.id ?? 4, name: "", username: "", password: "" });
    setFormError("");
    setModal({ type: "add" });
  };

  const openEdit = (user: ApiUser) => {
    setForm({ roleId: user.role.id, name: user.name, username: user.username, password: "" });
    setFormError("");
    setModal({ type: "edit", user });
  };

  const save = async () => {
    if (!form.name.trim() || !form.username.trim()) { setFormError("Vui lòng nhập đầy đủ thông tin"); return; }
    if (modal.type === "add" && !form.password.trim()) { setFormError("Vui lòng nhập mật khẩu"); return; }
    setSaving(true); setFormError("");
    try {
      if (modal.type === "edit") {
        const data: any = { roleId: form.roleId, name: form.name, username: form.username };
        if (form.password.trim()) data.password = form.password;
        await api.put(`/users/${modal.user.id}`, data);
      } else {
        await api.post("/users", form);
      }
      await loadUsers();
      setModal({ type: "none" });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Vô hiệu hóa tài khoản "${username}"?`)) return;
    try { await api.delete(`/users/${id}`); await loadUsers(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Xóa thất bại"); }
  };

  return (
    <AppShell title="Người dùng">
      <div className="mb-4">
        <Button variant="primary" size="sm" onClick={openAdd}>+ Thêm người dùng</Button>
      </div>

      {pageError && <div className="mb-4"><Alert type="error" message={pageError} /></div>}

      {loading ? (
        <div className="text-center text-gray-400 py-8 text-sm">Đang tải...</div>
      ) : (
        <div className="flex flex-col gap-1">
          {users.map((u) => (
            <Card key={u.id} className="!mb-0">
              <div className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{u.name}</span>
                    <Badge variant={ROLE_BADGE[u.role.code] ?? ""}>
                      {ROLE_NAMES[u.role.code] ?? u.role.name}
                    </Badge>
                    {!u.isActive && <span className="text-xs text-red-500">Vô hiệu</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">{u.username}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {/* Nút QR */}
                  <Button size="sm" onClick={() => setModal({ type: "qr", user: u })}>
                    QR
                  </Button>
                  <Button size="sm" onClick={() => openEdit(u)}>Sửa</Button>
                  {u.id !== currentUser?.id && (
                    <Button size="sm" variant="danger" onClick={() => handleDelete(u.id, u.username)}>
                      Xóa
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {users.length === 0 && (
            <div className="text-center text-gray-400 py-8 text-sm">Không có người dùng nào</div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal.type === "add" || modal.type === "edit") && (
        <Modal
          title={modal.type === "add" ? "Thêm người dùng" : "Chỉnh sửa người dùng"}
          onClose={() => setModal({ type: "none" })}
          footer={
            <>
              <Button onClick={() => setModal({ type: "none" })}>Hủy</Button>
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? "Đang lưu..." : modal.type === "add" ? "Lưu" : "Cập nhật"}
              </Button>
            </>
          }
        >
          {formError && <div className="mb-4"><Alert type="error" message={formError} /></div>}
          <div className="grid grid-cols-2 gap-4">
            <FormGroup label="Họ tên" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormGroup>
            <FormGroup label="Tên đăng nhập" required>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </FormGroup>
            <FormGroup label={modal.type === "edit" ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"} required={modal.type === "add"}>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </FormGroup>
            <FormGroup label="Vai trò">
              <Select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })}>
                {roles.map((r) => <option key={r.id} value={r.id}>{ROLE_NAMES[r.code] ?? r.name}</option>)}
              </Select>
            </FormGroup>
          </div>

          {/* QR preview khi edit */}
          {modal.type === "edit" && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-3">Mã QR đăng nhập</p>
              <div className="flex items-center gap-4">
                <QRGenerator text={form.username} size={120} />
                <div className="text-xs text-gray-400">
                  <p>Scan mã này tại trang đăng nhập</p>
                  <p className="mt-1 font-mono text-gray-600">{form.username}</p>
                  <p className="mt-2 text-[11px] text-gray-400">
                    * QR sẽ cập nhật nếu bạn đổi tên đăng nhập
                  </p>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* QR Modal riêng — xem nhanh không cần mở form edit */}
      {modal.type === "qr" && (
        <Modal
          title={`Mã QR — ${modal.user.name}`}
          onClose={() => setModal({ type: "none" })}
          footer={<Button onClick={() => setModal({ type: "none" })}>Đóng</Button>}
        >
          <div className="flex flex-col items-center gap-4 py-3">
            <QRGenerator text={modal.user.username} size={200} />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{modal.user.name}</p>
              <p className="text-xs text-gray-400 mt-1 font-mono">{modal.user.username}</p>
              <p className="text-xs text-gray-400 mt-1">
                {ROLE_NAMES[modal.user.role.code] ?? modal.user.role.name}
              </p>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Scan mã này tại trang đăng nhập để tự điền tên đăng nhập
            </p>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
