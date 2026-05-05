// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { HydrationProvider } from "@/components/layout/HydrationProvider";

export const metadata: Metadata = {
  title: "Cát Tường WMS",
  description: "Hệ thống quản lý kho hàng",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>" },
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <HydrationProvider>{children}</HydrationProvider>
      </body>
    </html>
  );
}
