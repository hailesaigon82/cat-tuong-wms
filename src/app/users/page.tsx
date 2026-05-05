// src/app/users/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAppStore, ROLE_NAMES } from "@/store";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Badge, Card, CardHeader, Table, Th, Td, Modal, FormGroup, Input, Select, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ApiUser } from "@/types/api";

type ModalState = { type: "none" } | { type: "add" } | { type: "edit"; user: ApiUser };

const ROLE_BADGE: Record<string, string> = {
  admin: "admin", manager: "manager", office: "office", warehouse: "warehouse",
};

export default function UsersPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const can         = useAppStore((s) => s.can);
  const isAdmin     = currentUser?.role.code === "admin";

  const [users, setUsers]       = useState<ApiUser[]>([]);
  const [roles, setRoles]       = useState<{ id: number; code: string; name: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [pageError, setPageError] = useState("");
  const [modal, setModal]       = useState<ModalState>({ type: "none" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ roleId: 4, name: "", username: "", password: "" });

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
    // Load roles cho dropdown — lọc admin nếu không phải admin
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
    try {
      await api.delete(`/users/${id}`);
      await loadUsers();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Xóa thất bại");
    }
  };

  return (
    <AppShell title="Người dùng">
      <div className="mb-4">
        <Button variant="primary" onClick={openAdd}>+ Thêm người dùng</Button>
      </div>
      {pageError && <div className="mb-4"><Alert type="error" message={pageError} /></div>}
      <Card>
        <CardHeader title={`Danh sách người dùng (${users.length})`} />
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <Table>
            <thead>
              <tr><Th>Họ tên</Th><Th>Tên đăng nhập</Th><Th>Vai trò</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <Td>{u.name}</Td>
                  <Td className="font-mono text-xs">{u.username}</Td>
                  <Td><Badge variant={ROLE_BADGE[u.role.code] ?? ""}>{ROLE_NAMES[u.role.code] ?? u.role.name}</Badge></Td>
                  <Td>
                    <span className={`text-xs font-medium ${u.isActive ? "text-green-600" : "text-red-500"}`}>
                      {u.isActive ? "Hoạt động" : "Vô hiệu"}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => openEdit(u)}>Sửa</Button>
                      {u.id !== currentUser?.id && (
                        <Button size="sm" variant="danger" onClick={() => handleDelete(u.id, u.username)}>Xóa</Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {(modal.type === "add" || modal.type === "edit") && (
        <Modal title={modal.type === "add" ? "Thêm người dùng" : "Chỉnh sửa người dùng"}
          onClose={() => setModal({ type: "none" })}
          footer={<>
            <Button onClick={() => setModal({ type: "none" })}>Hủy</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : modal.type === "add" ? "Lưu" : "Cập nhật"}
            </Button>
          </>}>
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
        </Modal>
      )}
    </AppShell>
  );
}
