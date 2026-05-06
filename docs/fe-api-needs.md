# Cát Tường WMS - Nhu cầu API của Frontend

Tài liệu này được scan từ frontend repo `cat-tuong-wms`. Mục tiêu là liệt kê các màn hình/component cần dữ liệu backend, API đang gọi nếu đã có, contract dữ liệu FE đang kỳ vọng, và trạng thái hiện tại.

Base URL frontend dùng qua `NEXT_PUBLIC_API_URL`, mặc định local là `http://localhost:4000/api/v1`.

## Tổng quan endpoint đang được FE dùng

| Endpoint | Nơi dùng | Trạng thái |
|---|---|---|
| `POST /auth/login` | Auth store, trang đăng nhập | existing |
| `POST /auth/refresh` | API client auto-refresh | existing |
| `POST /auth/logout` | Auth store, sidebar logout | existing |
| `GET /auth/me` | HydrationProvider/Auth store | existing |
| `GET /transactions/summary` | Dashboard | existing |
| `GET /transactions?limit=8` | Dashboard giao dịch gần đây | existing |
| `GET /transactions?limit=20&page={page}` | Lịch sử giao dịch | existing |
| `POST /transactions` | Nhập/xuất/điều chỉnh kho | existing |
| `GET /items` | Hàng hóa, giao dịch | existing |
| `GET /items/categories` | Form thêm hàng hóa | existing |
| `POST /items` | Thêm hàng hóa | existing |
| `PUT /items/{id}` | Sửa hàng hóa | existing |
| `DELETE /items/{id}` | Xóa/vô hiệu hóa hàng hóa | existing |
| `GET /users` | Quản lý người dùng | existing |
| `GET /users/roles` | Form thêm/sửa người dùng | existing |
| `POST /users` | Thêm người dùng | existing |
| `PUT /users/{id}` | Sửa người dùng | existing |
| `DELETE /users/{id}` | Xóa/vô hiệu hóa người dùng | existing |

## Chi tiết theo màn hình/component

### `/login` - Trang đăng nhập

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/login/page.tsx` |
| Feature | Đăng nhập bằng username/password hoặc quét QR để điền username |
| User action | Nhập username/password và bấm `Đăng nhập` |
| Data needed | Thông tin user hiện tại, permissions, access token, refresh token |
| Existing API call | `api.post<LoginResponse>("/auth/login", { username, password }, { skipRefresh: true })` trong `src/store/index.ts` |
| Expected endpoint | `POST /auth/login` |
| Request params/body | `{ username: string, password: string }` |
| Expected response fields | `accessToken`, `refreshToken`, `expiresIn`, `user.id`, `user.name`, `user.username`, `user.isActive`, `user.role.id`, `user.role.code`, `user.role.name`, `user.permissions[]` |
| Status | existing |

Ghi chú: QR login hiện chỉ điền username, không đăng nhập tự động. Payload QR hỗ trợ `USER-admin` hoặc `admin`.

### Auth bootstrap - Khôi phục phiên đăng nhập

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/components/layout/HydrationProvider.tsx`, `src/store/index.ts` |
| Feature | Khi app mở lại, khôi phục session từ token trong `localStorage` |
| User action | Mở app hoặc refresh browser khi đã có token |
| Data needed | User hiện tại và permissions mới nhất từ backend |
| Existing API call | `api.get<ApiUser & { permissions: string[] }>("/auth/me")` |
| Expected endpoint | `GET /auth/me` |
| Request params/body | Header `Authorization: Bearer <accessToken>` |
| Expected response fields | `id`, `name`, `username`, `isActive`, `role`, `permissions[]`; nếu backend đã hỗ trợ category access thì nên có `allowedCategoryIds[]` |
| Status | existing, nhưng `allowedCategoryIds` còn unclear ở FE types |

### API client - Refresh token

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/lib/api.ts` |
| Feature | Tự refresh access token khi backend trả `401` |
| User action | Bất kỳ request authenticated nào gặp access token hết hạn |
| Data needed | Access token mới |
| Existing API call | `fetch(`${BASE_URL}/auth/refresh`, { method: "POST", body: JSON.stringify({ refreshToken }) })` |
| Expected endpoint | `POST /auth/refresh` |
| Request params/body | `{ refreshToken: string }` |
| Expected response fields | `accessToken` |
| Status | existing |

### Sidebar/AppShell - Điều hướng và đăng xuất

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/components/layout/AppShell.tsx`, `src/components/layout/Sidebar.tsx` |
| Feature | Hiển thị user hiện tại, role, menu theo permission; đăng xuất |
| User action | Bấm `Đăng xuất` |
| Data needed | `currentUser`, `currentUser.role`, `currentUser.permissions[]`, refresh token |
| Existing API call | `api.post("/auth/logout", { refreshToken }, { skipRefresh: true })` |
| Expected endpoint | `POST /auth/logout` |
| Request params/body | `{ refreshToken: string }` |
| Expected response fields | Không dùng response body; chỉ cần success status |
| Status | existing |

Ghi chú: menu không gọi backend trực tiếp; dữ liệu lấy từ auth store sau login/hydrate.

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/components/layout/Sidebar.tsx` hoặc user menu trong AppShell |
| Feature | Nhân viên tự đổi mật khẩu |
| User action | Click vào tên nhân viên ở sidebar, mở dropdown, chọn đổi mật khẩu |
| Data needed | Xác nhận mật khẩu hiện tại và mật khẩu mới |
| Existing API call | Cần thêm `api.post("/auth/change-password", { currentPassword, newPassword })` |
| Expected endpoint | `POST /auth/change-password` |
| Request params/body | `{ currentPassword: string, newPassword: string }` |
| Expected response fields | `{ message: string }`; sau khi thành công nên logout local và đưa user về login |
| Status | existing |

### `/dashboard` - Tổng quan

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/dashboard/page.tsx` |
| Feature | KPI tổng quan tồn kho |
| User action | Mở dashboard |
| Data needed | Tổng số mặt hàng, tổng giá trị tồn kho, số giao dịch hôm nay, số item tồn thấp, danh sách item tồn thấp |
| Existing API call | `api.get<DashboardSummary>("/transactions/summary")` |
| Expected endpoint | `GET /transactions/summary` |
| Request params/body | Không có query params |
| Expected response fields | `totalItems`, `totalInventoryValue`, `todayTransactions`, `lowStockCount`, `lowStockItems[]`; mỗi `lowStockItems[]` cần `id`, `code`, `name`, `qty`, `minQty`, `unit`, `category.code` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/dashboard/page.tsx` |
| Feature | Giao dịch gần đây |
| User action | Mở dashboard |
| Data needed | 8 giao dịch mới nhất |
| Existing API call | `api.get<{ data: ApiTransaction[] }>("/transactions?limit=8")` |
| Expected endpoint | `GET /transactions` |
| Request params/body | Query: `limit=8` |
| Expected response fields | `data[]` với `id`, `type`, `qty`, `totalPrice`, `createdAt`, `item.name`, `user.name`; pagination không dùng trên dashboard |
| Status | existing |

### `/items` - Quản lý hàng hóa

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/items/page.tsx` |
| Feature | Danh sách hàng hóa và tìm kiếm client-side |
| User action | Mở trang hàng hóa, nhập ô tìm kiếm |
| Data needed | Danh sách item user được phép xem |
| Existing API call | `api.get<ApiItem[]>("/items")`; với dropdown/search lớn có thể gọi `api.get<ApiItem[]>(`/items?search=${term}&limit=20`)` |
| Expected endpoint | `GET /items` |
| Request params/body | Optional query: `search` hoặc `q`, `code`, `categoryId`, `page`, `limit` |
| Expected response fields | `id`, `categoryId`, `name`, `code`, `unit`, `qty`, `unitPrice`, `minQty`, `isActive`, `category.id`, `category.code`, `category.name`, `createdAt`, `updatedAt` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/items/page.tsx` |
| Feature | Form thêm hàng hóa |
| User action | Bấm `+ Thêm`, chọn danh mục |
| Data needed | Danh sách danh mục hàng hóa user được phép tạo/xem |
| Existing API call | `api.get<ApiCategory[]>("/items/categories")` |
| Expected endpoint | `GET /items/categories` |
| Request params/body | Không có query params |
| Expected response fields | `id`, `code`, `name`, `description?` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/items/page.tsx` |
| Feature | Tạo hàng hóa |
| User action | Submit modal thêm hàng hóa |
| Data needed | Item mới được lưu |
| Existing API call | `api.post("/items", form)` |
| Expected endpoint | `POST /items` |
| Request params/body | `{ categoryId: number, name: string, code: string, unit: string, qty: number, unitPrice: number, minQty: number }` |
| Expected response fields | FE không dùng body trực tiếp; sau khi lưu gọi lại `GET /items`. Backend nên trả item vừa tạo hoặc success status |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/items/page.tsx` |
| Feature | Sửa hàng hóa |
| User action | Submit modal sửa hàng hóa |
| Data needed | Item đã cập nhật |
| Existing API call | `api.put(`/items/${modal.item.id}`, { name, unit, unitPrice, minQty })` |
| Expected endpoint | `PUT /items/{id}` |
| Request params/body | Path `id`; body `{ name: string, unit: string, unitPrice: number, minQty: number }` |
| Expected response fields | FE không dùng body trực tiếp; sau khi lưu gọi lại `GET /items`. Backend nên trả item đã cập nhật hoặc success status |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/items/page.tsx` |
| Feature | Xóa/vô hiệu hóa hàng hóa |
| User action | Bấm `Xóa` và confirm |
| Data needed | Success/failure |
| Existing API call | `api.delete(`/items/${id}`)` |
| Expected endpoint | `DELETE /items/{id}` |
| Request params/body | Path `id` |
| Expected response fields | FE không dùng body trực tiếp; sau khi xóa gọi lại `GET /items` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/items/page.tsx`, `src/components/qr/QRGenerator.tsx` |
| Feature | Xem QR từng hàng hóa |
| User action | Bấm `QR` trên item |
| Data needed | `item.code`, `item.name`, `item.category.name` đã có từ `GET /items` |
| Existing API call | Không có API riêng |
| Expected endpoint | Không cần endpoint riêng |
| Request params/body | Không có |
| Expected response fields | Không có |
| Status | existing |

Ghi chú: với dropdown Hàng Hóa ở các form, nên dùng server-side search khi dữ liệu lớn: debounce input khoảng 250-400ms, gọi `GET /items?search=<term>&limit=20`, hiển thị loading state, và chỉ fallback `GET /items` full list cho màn hình quản lý cần toàn bộ dữ liệu.

### `/transactions/in` - Nhập kho

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/transactions/in/page.tsx`, dùng `src/components/modals/TransactionForm.tsx` |
| Feature | Chọn hoặc quét QR hàng hóa để nhập kho |
| User action | Mở trang, chọn hàng hoặc scan QR |
| Data needed | Danh sách item user được phép thao tác, gồm tồn kho hiện tại |
| Existing API call | `api.get<ApiItem[]>("/items")`; dropdown lớn nên dùng `GET /items?search=<term>&limit=20` |
| Expected endpoint | `GET /items` |
| Request params/body | Optional query: `search` hoặc `q`, `code`, `categoryId`, `page`, `limit` |
| Expected response fields | `id`, `code`, `name`, `qty`, `unit`, `unitPrice`, `category.code` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/transactions/in/page.tsx`, dùng `src/components/modals/TransactionForm.tsx` |
| Feature | Ghi nhận nhập kho |
| User action | Bấm `Xác nhận Nhập kho` |
| Data needed | Tồn kho mới sau giao dịch |
| Existing API call | `api.post<{ newQty: number }>("/transactions", { itemId, type, qty, note })` |
| Expected endpoint | `POST /transactions` |
| Request params/body | `{ itemId: number, type: "in", qty: number, note?: string }` |
| Expected response fields | `newQty` |
| Status | existing |

### `/transactions/out` - Xuất kho

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/transactions/out/page.tsx`, dùng `src/components/modals/TransactionForm.tsx` |
| Feature | Chọn hoặc quét QR hàng hóa để xuất kho |
| User action | Mở trang, chọn hàng hoặc scan QR |
| Data needed | Danh sách item user được phép thao tác, gồm tồn kho hiện tại |
| Existing API call | `api.get<ApiItem[]>("/items")`; dropdown lớn nên dùng `GET /items?search=<term>&limit=20` |
| Expected endpoint | `GET /items` |
| Request params/body | Optional query: `search` hoặc `q`, `code`, `categoryId`, `page`, `limit` |
| Expected response fields | `id`, `code`, `name`, `qty`, `unit`, `unitPrice`, `category.code` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/transactions/out/page.tsx`, dùng `src/components/modals/TransactionForm.tsx` |
| Feature | Ghi nhận xuất kho |
| User action | Bấm `Xác nhận Xuất kho` |
| Data needed | Tồn kho mới sau giao dịch, lỗi nếu xuất quá tồn |
| Existing API call | `api.post<{ newQty: number }>("/transactions", { itemId, type, qty, note })` |
| Expected endpoint | `POST /transactions` |
| Request params/body | `{ itemId: number, type: "out", qty: number, note?: string }` |
| Expected response fields | `newQty`; lỗi backend nên trả `message` nếu không đủ tồn |
| Status | existing |

### `/transactions/adj` - Điều chỉnh tồn kho

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/transactions/adj/page.tsx`, dùng `src/components/modals/TransactionForm.tsx` |
| Feature | Chọn hoặc quét QR hàng hóa để điều chỉnh tồn kho |
| User action | Mở trang, chọn hàng hoặc scan QR |
| Data needed | Danh sách item user được phép thao tác, gồm tồn kho hiện tại |
| Existing API call | `api.get<ApiItem[]>("/items")`; dropdown lớn nên dùng `GET /items?search=<term>&limit=20` |
| Expected endpoint | `GET /items` |
| Request params/body | Optional query: `search` hoặc `q`, `code`, `categoryId`, `page`, `limit` |
| Expected response fields | `id`, `code`, `name`, `qty`, `unit`, `unitPrice`, `category.code` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/transactions/adj/page.tsx`, dùng `src/components/modals/TransactionForm.tsx` |
| Feature | Ghi nhận điều chỉnh tồn kho về số lượng chính xác |
| User action | Bấm `Xác nhận Điều chỉnh tồn kho` |
| Data needed | Tồn kho mới sau điều chỉnh |
| Existing API call | `api.post<{ newQty: number }>("/transactions", { itemId, type, qty, note })` |
| Expected endpoint | `POST /transactions` |
| Request params/body | `{ itemId: number, type: "adj", qty: number, note?: string }`; UI đang ghi chú bắt buộc nhưng validation FE chưa bắt buộc |
| Expected response fields | `newQty` |
| Status | existing, note bắt buộc còn unclear giữa UI và API contract |

### `QRScanner` - Quét QR hàng hóa/user

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/components/qr/QRScanner.tsx`, dùng ở `/login` và các trang `/transactions/*` |
| Feature | Đọc payload QR từ camera |
| User action | Bấm mở camera và đưa QR vào khung hình |
| Data needed | Không gọi backend trực tiếp; xử lý payload local |
| Existing API call | Không có |
| Expected endpoint | Không cần endpoint riêng |
| Request params/body | Không có |
| Expected response fields | Không có |
| Status | existing |

Ghi chú: với transaction, QR chỉ map code vào danh sách item đã load từ `GET /items`. Nếu muốn scan item không nằm trong danh sách đã load hoặc cần lookup realtime, có thể cần `GET /items/by-code/{code}` hoặc `GET /items?code=H0001`; hiện chưa có call này, trạng thái optional/missing.

### `/history` - Lịch sử giao dịch

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/history/page.tsx` |
| Feature | Danh sách lịch sử giao dịch có phân trang |
| User action | Mở trang lịch sử, bấm chuyển trang |
| Data needed | Giao dịch theo trang và tổng số bản ghi |
| Existing API call | `api.get<TransactionListResponse>(`/transactions?limit=${LIMIT}&page=${p}`)` |
| Expected endpoint | `GET /transactions` |
| Request params/body | Query: `limit=20`, `page=<number>` |
| Expected response fields | `data[]`, `pagination.total`, `pagination.page`, `pagination.limit`, `pagination.totalPages`; mỗi transaction cần `id`, `item.code`, `item.name`, `item.category.code`, `createdAt`, `user.name`, `note`, `type`, `qty`, `totalPrice` |
| Status | existing |

Ghi chú: FE chưa có filter theo ngày, loại giao dịch, user, item. Nếu cần nghiệp vụ tra cứu nâng cao thì endpoint có thể mở rộng query `type`, `from`, `to`, `itemId`, `userId`, `search`; hiện chưa có UI/call.

### `/users` - Quản lý người dùng

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/users/page.tsx` |
| Feature | Danh sách người dùng |
| User action | Mở trang người dùng |
| Data needed | User list và role từng user |
| Existing API call | `api.get<ApiUser[]>("/users")` |
| Expected endpoint | `GET /users` |
| Request params/body | Không có query params |
| Expected response fields | `id`, `name`, `username`, `isActive`, `role.id`, `role.code`, `role.name`, `createdAt?` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/users/page.tsx` |
| Feature | Role dropdown khi thêm/sửa user |
| User action | Bấm thêm/sửa user |
| Data needed | Danh sách role có thể gán |
| Existing API call | `api.get<typeof roles>("/users/roles")` |
| Expected endpoint | `GET /users/roles` |
| Request params/body | Không có query params |
| Expected response fields | `id`, `code`, `name` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/users/page.tsx` |
| Feature | Tạo user |
| User action | Submit modal thêm user |
| Data needed | User mới được lưu |
| Existing API call | `api.post("/users", form)` |
| Expected endpoint | `POST /users` |
| Request params/body | `{ roleId: number, name: string, username: string, password: string }` |
| Expected response fields | FE không dùng body trực tiếp; sau khi lưu gọi lại `GET /users`. Backend nên trả user vừa tạo hoặc success status |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/users/page.tsx` |
| Feature | Sửa user |
| User action | Submit modal sửa user |
| Data needed | User đã cập nhật |
| Existing API call | `api.put(`/users/${modal.user.id}`, data)` |
| Expected endpoint | `PUT /users/{id}` |
| Request params/body | Path `id`; body `{ roleId: number, name: string, username: string, password?: string }` |
| Expected response fields | FE không dùng body trực tiếp; sau khi lưu gọi lại `GET /users`. Backend nên trả user đã cập nhật hoặc success status |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/users/page.tsx` |
| Feature | Xóa/vô hiệu hóa user |
| User action | Bấm `Xóa` và confirm |
| Data needed | Success/failure |
| Existing API call | `api.delete(`/users/${id}`)` |
| Expected endpoint | `DELETE /users/{id}` |
| Request params/body | Path `id` |
| Expected response fields | FE không dùng body trực tiếp; sau khi xóa gọi lại `GET /users` |
| Status | existing |

| Hạng mục | Nội dung |
|---|---|
| Route/page | `src/app/users/page.tsx`, `src/components/qr/QRGenerator.tsx` |
| Feature | Xem QR đăng nhập từng user |
| User action | Bấm `QR` hoặc mở modal edit user |
| Data needed | `user.username`, `user.name`, `user.role` đã có từ `GET /users` |
| Existing API call | Không có API riêng |
| Expected endpoint | Không cần endpoint riêng |
| Request params/body | Không có |
| Expected response fields | Không có |
| Status | existing |

Ghi chú: FE lọc role `admin` khỏi dropdown nếu current user không phải admin. Backend vẫn cần enforce manager không quản lý tài khoản admin. Nếu `/users` trả cả admin cho manager, FE hiện vẫn render action QR/Sửa/Xóa cho admin account; trạng thái UX này là unclear theo rule phân quyền.

## Các nhu cầu API còn thiếu hoặc chưa rõ

| Nhu cầu | Màn hình liên quan | Endpoint inferable | Lý do | Status |
|---|---|---|---|---|
| `allowedCategoryIds` trong auth response | Login, hydrate, permission/category UI | `POST /auth/login`, `GET /auth/me` | Pending đã nêu trong project context; FE types chưa khai báo field này | unclear |
| Search/pagination server-side cho item | `/items`, `/transactions/*` | `GET /items?search=&page=&limit=` | BE đã hỗ trợ query search/limit trên response array cũ; FE nên dùng debounce cho dropdown lớn | existing |
| Lookup item realtime bằng QR/code | `/transactions/*`, `QRScanner` | `GET /items?code=H0001` | BE đã hỗ trợ lookup bằng query `code`, vẫn lọc theo category access | existing |
| Filter lịch sử nâng cao | `/history` | `GET /transactions?type=&from=&to=&itemId=&userId=&search=` | UI hiện chỉ phân trang, chưa có filter nghiệp vụ | missing/optional |
| Contract bắt buộc note khi adjustment | `/transactions/adj` | `POST /transactions` | UI ghi `Ghi chú (bắt buộc)` nhưng FE gửi `note?: string`; cần thống nhất backend có require không | unclear |
| Response body chuẩn cho create/update/delete | `/items`, `/users` | Các endpoint mutation hiện có | FE hiện không dùng body, chỉ refresh lại list; backend có thể trả success hoặc entity, cần chuẩn hóa docs backend | unclear |
