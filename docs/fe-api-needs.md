# Cát Tường WMS - FE API Contract

Tài liệu này ghi lại phần frontend đang phụ thuộc vào backend. Chi tiết đầy đủ của backend nằm ở `docs/be-api-inventory.md`; file này chỉ giữ các contract FE cần biết để tránh lệch khi sửa UI.

Base URL: `NEXT_PUBLIC_API_URL`, mặc định local `http://localhost:4000/api/v1`.

## Snapshot hiện tại

- Auth token lưu trong `sessionStorage`; FE xóa token legacy trong `localStorage`.
- Login gọi `POST /auth/login` với `{ skipAuth: true, skipRefresh: true }`.
- Demo accounts chỉ hiển thị khi `NODE_ENV !== "production"`.
- History dùng phân trang `limit=50`.
- History xuất nhập gọi `types=in,out`; history điều chỉnh gọi `type=adj`.
- Date filter history gửi nguyên ngày: `from=T00:00:00.000`, `to=T23:59:59.999`.
- `POST /transactions` yêu cầu `note` cho nhập, xuất, điều chỉnh.
- Item contract có `numOfTrans`; FE có nút admin để gọi recompute khi cần đồng bộ lại counter.
- Tab popular là `Hương liệu phổ biến (T30)`, lấy top 30 theo `numOfTrans`.

## Endpoint FE đang dùng

| Nhóm | Endpoint | Nơi dùng | Ghi chú FE |
|---|---|---|---|
| Auth | `POST /auth/login` | Login | Body `{ username, password }`; response cần token + user + permissions + `allowedCategoryIds`. |
| Auth | `GET /auth/me` | Hydration | Reload current user bằng access token. |
| Auth | `POST /auth/refresh` | API client | Refresh access token khi 401. |
| Auth | `POST /auth/logout` | Sidebar logout | Body `{ refreshToken }`; FE chỉ cần success. |
| Auth | `POST /auth/change-password` | User menu | Sau success FE logout local. |
| Items | `GET /items` | Hàng hóa, transaction form | Response `ApiItem[]`, gồm `numOfTrans` và `category`. |
| Items | `GET /items?search={term}&limit=20` | Dropdown item | Dùng cho search server-side khi list lớn. |
| Items | `GET /items?code={code}` | QR/code lookup | Fallback khi scan QR không có trong list đã load. |
| Items | `GET /items/popular?limit=30&categoryCodes=R,N` | Tab popular | Response `ApiItem[]`; cột số giao dịch dùng `numOfTrans`. |
| Items | `POST /items/recompute-transaction-counts` | User `hai` trong form Hàng hóa | BE admin-only; FE chỉ hiện nút cho username `hai`; response `{ totalItems, updatedItems }`. |
| Items | `GET /items/categories?action=create` | Form thêm item | Chỉ category user được tạo. |
| Items | `GET /items/categories?action=edit` | Form sửa item | Chỉ category user được sửa. |
| Items | `GET /items/categories?action=delete` | Quyền xóa item | Dùng để quyết định action delete theo category. |
| Items | `POST /items` | Thêm item | FE không gửi `numOfTrans`. |
| Items | `PUT /items/{id}` | Sửa item | FE không gửi `numOfTrans`. |
| Items | `DELETE /items/{id}` | Xóa item | Soft delete phía BE; FE refresh list. |
| Transactions | `POST /transactions` | Nhập/xuất/điều chỉnh | Body `{ itemId, type, qty, note }`; response cần `newQty`. |
| History | `GET /transactions?limit=50&page={p}&types=in,out` | Lịch sử xuất nhập | Cần `data[]` + `pagination`. |
| History | `GET /transactions?limit=50&page={p}&type=adj` | Lịch sử điều chỉnh | Cùng form, filter khác type. |
| Users | `GET /users` | Quản lý user | List user + role. |
| Users | `GET /users/roles` | Dropdown role | BE đã lọc role admin cho non-admin. |
| Users | `POST /users` | Tạo user | Body `{ roleId, name, username, password }`. |
| Users | `PUT /users/{id}` | Sửa user | Body subset user editable fields. |
| Users | `DELETE /users/{id}` | Xóa user | Soft delete phía BE. |

## Contract trọng yếu

### `ApiItem`

FE kỳ vọng item có tối thiểu:

```ts
{
  id: number;
  categoryId: number;
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  minQty: number;
  numOfTrans: number;
  isActive: boolean;
  category: { id: number; code: string; name: string };
}
```

`numOfTrans` là counter cache do BE cập nhật khi tạo/reverse transaction. FE đọc field này cho tab popular và cột “Số giao dịch”; không dùng `transactionCount`.

### Recompute `numOfTrans`

FE chỉ hiển thị nút này cho user có `username === "hai"`. BE vẫn enforce quyền bằng `roleCode === "admin"`.

```http
POST /api/v1/items/recompute-transaction-counts
```

Response:

```ts
{
  totalItems: number;
  updatedItems: number;
}
```

Endpoint đồng bộ `items.num_of_trans` từ `COUNT(*) FROM transactions GROUP BY itemId`. Nó không tạo transaction mới, không đổi `items.qty`, không sửa/xóa history, không phụ thuộc category access. BE check trực tiếp `roleCode === "admin"` và dùng advisory lock chung với create/reverse transaction. DB runtime phải đã apply migration thêm cột `items.num_of_trans`.

### `POST /transactions`

```ts
{
  itemId: number;
  type: "in" | "out" | "adj";
  qty: number;
  note: string;
}
```

- `in`/`out`: `qty > 0`.
- `adj`: `qty >= 0`.
- Response cần `newQty`.
- UX success: nhập/xuất hiển thị số lượng phát sinh + tồn kho mới; điều chỉnh hiển thị tồn kho cũ => tồn kho mới.

### History pagination

FE dùng chung form history nhưng query khác:

- Xuất nhập: `limit=50&page={p}&types=in,out`
- Điều chỉnh: `limit=50&page={p}&type=adj`
- Date filter nếu có: `from={yyyy-mm-dd}T00:00:00.000`, `to={yyyy-mm-dd}T23:59:59.999`

Response cần:

```ts
{
  data: ApiTransaction[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}
```

## Hàng hóa tabs

| Tab | Data source | Rule |
|---|---|---|
| `Kho Hương liệu` | `GET /items` | FE lọc category code `R/N`; tab count không có ngoặc. |
| `Hương liệu phổ biến (T30)` | `GET /items/popular?limit=30&categoryCodes=R,N` | Không hiển thị count trên tab; table dùng `numOfTrans`. |
| `Hóa đơn` | `GET /items` | FE lọc category code `I`; tab count không có ngoặc. |

Sau create/update/delete item, FE reload list và invalidate popular cache. Nếu đang ở tab popular thì reload lại popular.

## Dashboard

BE có `GET /transactions/summary`, nhưng FE dashboard hiện chưa render KPI đầy đủ. Đây là endpoint planned/available, không phải dependency runtime bắt buộc hiện tại.

## QR

QR scanner không cần endpoint riêng:

- Login QR chỉ điền username.
- Transaction QR map code vào item list đã load.
- Nếu không tìm thấy item trong list, FE có thể fallback `GET /items?code={code}`.

## Cần theo dõi

| Vấn đề | Loại | Ghi chú |
|---|---|---|
| Item list cho transaction đang dựa trên `canView` + permission transaction global | Monitor | Nếu sau này quyền nhập/xuất/điều chỉnh tách theo category, cần contract mới để biết item nào thao tác được. |
| Dashboard KPI chưa render đầy đủ | Planned | BE đã có `/transactions/summary`. |
| Filter history theo `userId`/`search` | Optional | BE hiện có `type/types`, `itemId`, `from`, `to`, `page`, `limit`; UI chưa cần `userId/search`. |
| Token trong `sessionStorage` | Tech debt | Tốt hơn `localStorage` về persistence, nhưng vẫn đọc được bởi JS nếu có XSS; hardening tối đa nên cân nhắc HttpOnly cookie. |
