// src/app/login/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { Button, Alert, Input, FormGroup } from "@/components/ui";
import { QRScanner } from "@/components/qr/QRScanner";

export default function LoginPage() {
  const login       = useAppStore((s) => s.login);
  const isLoading   = useAppStore((s) => s.isLoading);
  const error       = useAppStore((s) => s.error);
  const clearError  = useAppStore((s) => s.clearError);
  const currentUser = useAppStore((s) => s.currentUser);
  const router      = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role.code === "warehouse") {
      router.replace("/transactions?scan=1");
      return;
    }
    router.replace("/dashboard");
  }, [currentUser, router]);

  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  const handleLogin = async () => {
    clearError();
    await login(username, password);
  };

  const handleQRScan = (data: string) => {
    // Hỗ trợ cả "USER-admin" lẫn "admin"
    const scanned = data.startsWith("USER-") ? data.replace("USER-", "") : data;
    setUsername(scanned);
    setShowScanner(false);
    setTimeout(() => document.getElementById("password")?.focus(), 100);
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

        {showScanner ? (
          <div className="mb-4">
            <QRScanner
              onScan={handleQRScan}
              // Không set prefix — chấp nhận mọi QR code
              onClose={() => setShowScanner(false)}
              label="Hướng mã QR vào camera để tự điền tên đăng nhập"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowScanner(true)}
            className="w-full border-2 border-dashed border-gray-200 hover:border-[#185FA5] rounded-lg p-4 text-center mb-4 transition-colors group"
          >
            <div className="text-3xl mb-1.5">📷</div>
            <div className="text-sm font-medium text-gray-600 group-hover:text-[#185FA5]">
              Quét mã QR của bạn
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Nhấn để mở camera</div>
          </button>
        )}

        <div className="relative text-center text-xs text-gray-400 mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <span className="relative bg-white px-3">hoặc nhập thủ công</span>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          <FormGroup label="Tên đăng nhập">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              disabled={isLoading}
            />
          </FormGroup>
          <FormGroup label="Mật khẩu">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              disabled={isLoading}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </FormGroup>
        </div>

        <Button
          variant="primary"
          className="w-full justify-center py-2.5"
          onClick={handleLogin}
          disabled={isLoading || !username || !password}
        >
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
