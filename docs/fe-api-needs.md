# Cát Tường WMS - FE API Contract

Bản compact các contract backend mà frontend đang phụ thuộc. FE repo không lưu inventory chi tiết của BE; khi cần kiểm tra handler/schema thật thì đọc trực tiếp BE repo.

Base URL: `NEXT_PUBLIC_API_URL`, mặc định local `http://localhost:4000/api/v1`.

## Snapshot

- Token lưu trong `sessionStorage`; FE xóa key token legacy trong `localStorage`.
- Login gọi `POST /auth/login` với `{ skipAuth: true, skipRefresh: true }`.
- Component dùng `api.*`; không tự gọi `fetch` hoặc tự xử lý refresh token.
- History dùng `limit=50`.
- Tồn kho có thể bị mask. Nếu `stockHidden === true` hoặc giá trị tồn kho là `null`, FE render `NA`.
- Màn admin **Cài đặt** điều khiển Ẩn tồn kho bằng `GET /settings` và `PATCH /settings/hide-stock`.
- Category `description` và transaction `user.username` có thể vắng/null tùy endpoint; FE không phụ thuộc các field này để render nghiệp vụ chính.

## Endpoint FE Đang Dùng

| Nhóm | Endpoint | FE dùng để |
|---|---|---|
| Auth | `POST /auth/login` | Đăng nhập; cần token, user, permissions, `allowedCategoryIds`. |
| Auth | `GET /auth/me` | Hydrate user hiện tại. |
| Auth | `POST /auth/refresh` | API client refresh access token. |
| Auth | `POST /auth/logout` | Đăng xuất session hiện tại. |
| Auth | `POST /auth/change-password` | Modal đổi mật khẩu trong user menu. |
| Settings | `GET /settings` | Admin đọc `hideStock.enabled`. |
| Settings | `PATCH /settings/hide-stock` | Admin toggle với body `{ enabled: boolean }`. |
| Items | `GET /items` | Bảng hàng hóa và dữ liệu tìm hàng trong form giao dịch. |
| Items | `GET /items?search={term}&limit=20` | Search item server-side. |
| Items | `GET /items?code={code}` | Fallback QR/code lookup. |
| Items | `GET /items/popular?limit=30&categoryCodes=R,N` | Tab hương liệu phổ biến. |
| Items | `POST /items/recompute-transaction-counts` | User `hai`; BE vẫn admin-only. |
| Items | `GET /items/categories?action=create\|edit\|delete` | Quyền category cho UI thêm/sửa/xóa. |
| Items | `POST /items` | Tạo item. |
| Items | `PUT /items/{id}` | Sửa item. |
| Items | `DELETE /items/{id}` | Soft delete item rồi refresh list. |
| Transactions | `POST /transactions` | Tạo phiếu in/out/adj; response cần `newQty`. |
| Transactions | `POST /transactions/{id}/reverse` | Thu hồi giao dịch cuối trong form transaction. |
| History | `GET /transactions?limit=50&page={p}&types=in,out` | Lịch sử xuất/nhập. |
| History | `GET /transactions?limit=50&page={p}&type=adj` | Lịch sử điều chỉnh. |
| Users | `GET /users` | Danh sách user. |
| Users | `GET /users/roles` | Dropdown role. |
| Users | `POST /users` | Tạo user. |
| Users | `PUT /users/{id}` | Sửa user. |
| Users | `DELETE /users/{id}` | Soft delete user. |

## Shape Quan Trọng

### `ApiItem`

```ts
{
  id: number;
  categoryId: number;
  code: string;
  name: string;
  unit: string;
  qty: number | null;
  unitPrice: number;
  minQty: number | null;
  numOfTrans: number;
  isActive: boolean;
  stockHidden?: boolean;
  category: { id: number; code: string; name: string; description?: string | null };
}
```

Khi bật Ẩn tồn kho cho user `warehouse`, `qty` và `minQty` là `null`. FE phải render `NA`, không coi là `0`.

### `ApiTransaction`

```ts
{
  id: number;
  itemId: number;
  type: "in" | "out" | "adj";
  qty: number;
  stockBefore: number | null;
  stockHidden?: boolean;
  newQty?: number | null;
  item: ApiItem;
  user: { id: number; name: string; username?: string };
}
```

Khi tồn kho bị ẩn, `stockBefore` và `newQty` có thể là `null`; các cột Before/After/Balance render `NA`.

### Settings

```ts
{
  hideStock: {
    enabled: boolean;
  };
}
```

Chỉ admin thấy dòng **Cài đặt** trong menu user và truy cập được màn settings.

## Ghi Chú Theo Tính Năng

| Tính năng | Contract |
|---|---|
| Tab hàng hóa | Hương liệu lọc category `R/N`; Hóa đơn lọc category `H`; Popular gọi `/items/popular` và dùng `numOfTrans`. |
| Recompute `numOfTrans` | FE chỉ hiện nút cho username `hai`; BE enforce role admin. |
| Submit transaction | Body `{ itemId, type, qty, note }`; FE yêu cầu `note` cho mọi loại transaction. |
| Success transaction | Cập nhật selected item bằng `newQty`; nếu `newQty` là `null`, giữ trạng thái hidden và render `NA`. |
| Date filter history | Gửi `from={yyyy-mm-dd}T00:00:00.000`, `to={yyyy-mm-dd}T23:59:59.999`. |
| QR | Login QR điền username; item QR chấp nhận `ITEM-H0001` và `H0001`. |
| Dashboard | BE có `GET /transactions/summary`, nhưng FE dashboard hiện chưa phụ thuộc endpoint này. |

## Cần Theo Dõi

| Chủ đề | Trạng thái |
|---|---|
| Quyền transaction theo category | Monitor: form đang dựa vào item visibility + permission transaction global. Nếu tách quyền theo category, cần contract mới. |
| Dashboard KPI | Planned: BE có summary endpoint, màn FE vẫn tối giản. |
| History search/user filter | Optional: UI chưa cần `userId` hoặc text search. |
| Auth hardening | Tech debt: `sessionStorage` tốt hơn local persistent token, nhưng HttpOnly cookie/session sẽ cứng hơn. |
