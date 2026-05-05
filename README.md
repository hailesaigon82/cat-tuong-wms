# 🌸 Cát Tường WMS — Next.js

Hệ thống quản lý kho hàng (Warehouse Management System) được chuyển đổi từ HTML đơn sang **Next.js 14** với App Router, TypeScript, Tailwind CSS và Zustand.

## 🚀 Cài đặt & Chạy

```bash
npm install
npm run dev
```

Mở trình duyệt tại [http://localhost:3000](http://localhost:3000)

## 🔐 Tài khoản demo

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `admin123` | Quản trị viên |
| `manager1` | `mgr123` | Quản lý |
| `office1` | `off123` | Nhân viên văn phòng |
| `wh1` | `wh123` | Nhân viên kho |

## 📁 Cấu trúc dự án

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Redirect to /login or /dashboard
│   ├── globals.css
│   ├── login/page.tsx          # Trang đăng nhập (QR + username/password)
│   ├── dashboard/page.tsx      # Tổng quan KPIs
│   ├── items/page.tsx          # Quản lý hàng hóa
│   ├── transactions/
│   │   ├── in/page.tsx         # Nhập kho
│   │   ├── out/page.tsx        # Xuất kho
│   │   └── adj/page.tsx        # Điều chỉnh tồn kho
│   ├── history/page.tsx        # Lịch sử giao dịch
│   └── users/page.tsx          # Quản lý người dùng
├── components/
│   ├── ui/index.tsx            # Badge, Button, Alert, Modal, Card, Table...
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   └── AppShell.tsx        # Layout wrapper với auth guard
│   ├── qr/
│   │   ├── QRGenerator.tsx     # Tạo mã QR (qrcode)
│   │   └── QRScanner.tsx       # Quét mã QR (jsQR + camera)
│   └── modals/
│       └── TransactionForm.tsx # Form nhập/xuất/điều chỉnh
├── store/index.ts              # Zustand store (persist to localStorage)
├── types/index.ts              # TypeScript types
└── lib/utils.ts                # Utilities (fmtCurrency, cn...)
```

## ✨ Tính năng

- **Đăng nhập** bằng tên đăng nhập/mật khẩu hoặc quét QR code
- **Dashboard** với KPIs: tổng mặt hàng, tổng giá trị, cảnh báo tồn kho thấp, giao dịch hôm nay
- **Quản lý hàng hóa**: thêm/sửa/xóa, tìm kiếm, xem mã QR từng mặt hàng
- **Nhập kho / Xuất kho / Điều chỉnh**: hỗ trợ quét QR hàng hóa bằng camera
- **Lịch sử giao dịch** đầy đủ
- **Quản lý người dùng**: thêm/sửa/xóa, tạo mã QR đăng nhập
- **Phân quyền** theo vai trò (Admin, Quản lý, Văn phòng, Kho)
- **Persist data** vào localStorage qua Zustand persist middleware
- **Responsive** layout

## 🛠 Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Zustand** (state management + persistence)
- **qrcode** (tạo QR)
- **jsQR** (quét QR từ camera)
- **lucide-react** (icons)

## 🧭 Frontend instructions

Xem [FRONTEND_INSTRUCTIONS.md](./FRONTEND_INSTRUCTIONS.md) để nắm quy tắc làm việc cho FE: auth/API flow, phân quyền, QR, responsive UI và workflow kiểm tra trước khi deploy.

## 📦 Build production

```bash
npm run build
npm start
```
