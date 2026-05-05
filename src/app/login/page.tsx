// src/app/login/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { Button, Alert, Input, FormGroup } from "@/components/ui";

export default function LoginPage() {
  const login       = useAppStore((s) => s.login);
  const isLoading   = useAppStore((s) => s.isLoading);
  const error       = useAppStore((s) => s.error);
  const clearError  = useAppStore((s) => s.clearError);
  const currentUser = useAppStore((s) => s.currentUser);
  const router      = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (currentUser) router.replace("/dashboard");
  }, [currentUser, router]);

  const handleLogin = async () => {
    clearError();
    await login(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-4">
      <div className="bg-white rounded-2xl p-9 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-7">
          <div className="text-5xl mb-3">🌸</div>
          <h1 className="text-xl font-bold text-[#1a1a2e] tracking-tight">Cát Tường WMS</h1>
          <p className="text-sm text-gray-400 mt-1">Hệ thống quản lý kho hàng</p>
        </div>

        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

        <div className="flex flex-col gap-3 mb-5">
          <FormGroup label="Tên đăng nhập">
            <Input value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập" disabled={isLoading} />
          </FormGroup>
          <FormGroup label="Mật khẩu">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu" disabled={isLoading}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          </FormGroup>
        </div>

        <Button variant="primary" className="w-full justify-center py-2.5"
          onClick={handleLogin} disabled={isLoading || !username || !password}>
          {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>

        <div className="mt-5 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
          <strong className="text-gray-600">Tài khoản demo:</strong><br />
          admin / admin123 &nbsp;·&nbsp; manager1 / mgr123<br />
          office1 / off123 &nbsp;·&nbsp; wh1 / wh123
        </div>
      </div>
    </div>
  );
}
