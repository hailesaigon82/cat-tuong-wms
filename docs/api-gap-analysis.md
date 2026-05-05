# Cát Tường WMS - API Gap Analysis

Tài liệu này đối chiếu nhu cầu API của frontend trong `docs/fe-api-needs.md` với inventory backend trong `docs/be-api-inventory.md`.

Cập nhật ghi chú: backend source hiện có một số thay đổi mới hơn inventory doc:

- `POST /api/v1/auth/login` đã trả `user.isActive`.
- `GET /api/v1/auth/me` reload `permissions` và `allowedCategoryIds` từ DB.
- `GET /api/v1/items/categories` hỗ trợ query `action=view|create|edit|delete` và lọc category theo quyền action tương ứng.

Quy ước trạng thái:

- `Match`: BE API đáp ứng đúng nhu cầu FE theo tài liệu.
- `Missing`: FE có nhu cầu nhưng inventory BE chưa có endpoint tương ứng.
- `Mismatch`: FE và BE đang lệch contract rõ ràng.
- `Partial`: Có API tương ứng nhưng thiếu field, thiếu filter, hoặc hành vi chỉ đáp ứng một phần.
- `Unclear`: Tài liệu chưa đủ để kết luận chắc chắn.

## Summary Counts

| Status | Count |
|---|---:|
| Match | 26 |
| Partial | 2 |
| Missing | 2 |
| Mismatch | 0 |
| Unclear | 1 |
| Total | 31 |

## Gap Matrix

| ID | FE page/feature | FE user action | FE needed API | Matching BE API | Status | Issue | Recommended action | Owner | Priority |
|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | `/login` - đăng nhập | Nhập username/password và bấm đăng nhập | `POST /auth/login` | `POST /api/v1/auth/login` | Match | BE source đã trả đủ các field FE cần: token, `expiresIn`, `user.id/name/username/isActive/role/permissions`. BE còn trả thêm `allowedCategoryIds`. | FE có thể cập nhật type để dùng thêm `allowedCategoryIds`; không cần đổi BE cho nhu cầu login hiện tại. | FE | P2 |
| AUTH-02 | Auth bootstrap - khôi phục session | Refresh/mở lại app khi có token | `GET /auth/me` | `GET /api/v1/auth/me` | Match | BE source reload user, role permissions và `allowedCategoryIds` từ DB, đáp ứng nhu cầu FE về thông tin user/quyền mới nhất. | Không cần đổi API. FE nên model `allowedCategoryIds` trong type nếu muốn dùng field này. | FE | P2 |
| AUTH-03 | API client - refresh token | Request authenticated gặp 401 | `POST /auth/refresh` | `POST /api/v1/auth/refresh` | Match | BE trả `accessToken`, `expiresIn`; FE chỉ cần `accessToken`. | Không cần đổi. | None | P2 |
| AUTH-04 | Sidebar/AppShell - logout | Bấm `Đăng xuất` | `POST /auth/logout` | `POST /api/v1/auth/logout` | Match | Request body và response success phù hợp. | Không cần đổi. | None | P2 |
| DASH-01 | `/dashboard` - KPI tổng quan | Mở dashboard | `GET /transactions/summary` | `GET /api/v1/transactions/summary` | Match | Response fields khớp nhu cầu KPI và low-stock list. | Không cần đổi. | None | P2 |
| DASH-02 | `/dashboard` - giao dịch gần đây | Mở dashboard | `GET /transactions?limit=8` | `GET /api/v1/transactions` | Match | BE trả `data[]` và pagination; FE chỉ dùng `data[]`. | Không cần đổi. | None | P2 |
| ITEM-01 | `/items` - danh sách hàng hóa | Mở trang, tìm kiếm client-side | `GET /items` | `GET /api/v1/items` | Match | Response item và category khớp nhu cầu hiện tại; BE lọc theo `canView`. | Không cần đổi cho nhu cầu hiện tại. | None | P2 |
| ITEM-02 | `/items` - danh mục trong form thêm | Bấm `+ Thêm` | `GET /items/categories?action=create` | `GET /api/v1/items/categories?action=create` | Match | FE đã gọi category endpoint với `action=create`, khớp BE source lọc theo `canCreate`. | Không cần đổi thêm. | None | P2 |
| ITEM-03 | `/items` - tạo hàng hóa | Submit modal thêm item | `POST /items` | `POST /api/v1/items` | Match | Body FE gửi khớp BE schema; BE trả item, FE refresh list. | Không cần đổi. | None | P2 |
| ITEM-04 | `/items` - sửa hàng hóa | Submit modal sửa item | `PUT /items/{id}` | `PUT /api/v1/items/:id` | Match | Body FE gửi là subset hợp lệ của BE schema. | Không cần đổi. | None | P2 |
| ITEM-05 | `/items` - xóa/vô hiệu item | Bấm `Xóa` và confirm | `DELETE /items/{id}` | `DELETE /api/v1/items/:id` | Match | BE soft delete và trả message; FE chỉ cần success/failure. | Không cần đổi. | None | P2 |
| ITEM-06 | `/items` - xem QR item | Bấm `QR` trên item | Không cần API riêng | Không cần BE API | Match | QR dùng dữ liệu đã có từ `GET /items`. | Không cần đổi. | None | P2 |
| TX-IN-01 | `/transactions/in` - chọn/scan item | Mở trang, chọn item hoặc scan QR | `GET /items` | `GET /api/v1/items` | Match | BE transaction access dùng quyền chức năng `tx_in` và item thuộc category `canView`; `GET /items` cũng lọc theo `canView`, nên list item khớp điều kiện item mà BE cho phép nhập kho. | Không cần đổi thêm. | None | P2 |
| TX-IN-02 | `/transactions/in` - ghi nhận nhập kho | Bấm xác nhận nhập kho | `POST /transactions` body `type: "in"` | `POST /api/v1/transactions` | Match | Body và response `newQty` khớp; BE kiểm permission `tx_in`. | Không cần đổi. | None | P2 |
| TX-OUT-01 | `/transactions/out` - chọn/scan item | Mở trang, chọn item hoặc scan QR | `GET /items` | `GET /api/v1/items` | Match | BE transaction access dùng quyền chức năng `tx_out` và item thuộc category `canView`; `GET /items` cũng lọc theo `canView`, nên list item khớp điều kiện item mà BE cho phép xuất kho. | Không cần đổi thêm. | None | P2 |
| TX-OUT-02 | `/transactions/out` - ghi nhận xuất kho | Bấm xác nhận xuất kho | `POST /transactions` body `type: "out"` | `POST /api/v1/transactions` | Match | Body và response `newQty` khớp; BE kiểm permission `tx_out` và không cho xuất quá tồn. | Không cần đổi. | None | P2 |
| TX-ADJ-01 | `/transactions/adj` - chọn/scan item | Mở trang, chọn item hoặc scan QR | `GET /items` | `GET /api/v1/items` | Match | BE transaction access dùng quyền chức năng `tx_adj` và item thuộc category `canView`; `GET /items` cũng lọc theo `canView`, nên list item khớp điều kiện item mà BE cho phép điều chỉnh. | Không cần đổi thêm. | None | P2 |
| TX-ADJ-02 | `/transactions/adj` - ghi nhận điều chỉnh | Bấm xác nhận điều chỉnh | `POST /transactions` body `type: "adj"` kèm `note` bắt buộc | `POST /api/v1/transactions` | Match | FE đã validate bắt buộc ghi chú khi `type === "adj"` trước khi gửi request; khớp BE runtime requirement. | Không cần đổi thêm. | None | P2 |
| QR-01 | `QRScanner` - scan user/item QR | Mở camera và scan QR | Không cần API riêng | Không cần BE API | Match | Scanner xử lý payload local; transaction scan map với list item đã load. | Không cần đổi cho flow hiện tại. | None | P2 |
| HIST-01 | `/history` - phân trang giao dịch | Mở history, bấm chuyển trang | `GET /transactions?limit=20&page={page}` | `GET /api/v1/transactions` | Match | BE hỗ trợ `page` và `limit`, response pagination khớp. | Không cần đổi cho nhu cầu hiện tại. | None | P2 |
| USER-01 | `/users` - danh sách user | Mở trang users | `GET /users` | `GET /api/v1/users` | Match | Response khớp; BE inventory ghi non-admin không nhận user admin, phù hợp rule manager không quản lý admin. | Không cần đổi. | None | P2 |
| USER-02 | `/users` - role dropdown | Bấm thêm/sửa user | `GET /users/roles` | `GET /api/v1/users/roles` | Partial | FE need là danh sách role có thể gán; BE endpoint chỉ yêu cầu JWT và inventory không ghi lọc assignable roles. FE đang tự lọc role `admin` cho non-admin. | Nên để BE trả roles assignable theo requester, hoặc đổi tên/ghi contract rõ endpoint trả tất cả roles và FE tự lọc. | Both | P2 |
| USER-03 | `/users` - tạo user | Submit modal thêm user | `POST /users` | `POST /api/v1/users` | Match | Body và response khớp; BE enforce non-admin không tạo admin. | Không cần đổi. | None | P2 |
| USER-04 | `/users` - sửa user | Submit modal sửa user | `PUT /users/{id}` | `PUT /api/v1/users/:id` | Match | Body FE gửi là subset hợp lệ; BE enforce non-admin không sửa/gán admin. | Không cần đổi. | None | P2 |
| USER-05 | `/users` - xóa/vô hiệu user | Bấm `Xóa` và confirm | `DELETE /users/{id}` | `DELETE /api/v1/users/:id` | Match | BE soft delete, không cho tự xóa, không cho non-admin xóa admin. FE chỉ cần success/failure. | Không cần đổi. | None | P2 |
| USER-06 | `/users` - QR đăng nhập user | Bấm `QR` hoặc mở edit user | Không cần API riêng | Không cần BE API | Match | QR dùng `username` đã có từ `GET /users`. | Không cần đổi. | None | P2 |
| AUTH-05 | Auth category access | Login/hydrate rồi dùng quyền category | `allowedCategoryIds` trong `POST /auth/login` và `GET /auth/me` | BE login/me đều có `allowedCategoryIds` | Match | FE auth types đã model `allowedCategoryIds`, nên login/hydrate response contract không còn bị ẩn khỏi TypeScript. | Không cần đổi thêm. | None | P2 |
| ITEM-07 | `/items`, `/transactions/*` - search/pagination item server-side | Tìm item hoặc chọn item khi data lớn | `GET /items?search=&page=&limit=` | Không có trong inventory | Missing | BE `GET /items` không có query params; FE hiện load toàn bộ và filter client-side. | Chỉ thêm khi dữ liệu đủ lớn hoặc UX cần server-side search. Không đổi endpoint hiện tại nếu chưa cần. | Both | P2 |
| ITEM-08 | `/transactions/*`, `QRScanner` - lookup item bằng code | Scan QR item không nằm trong list đã load | `GET /items?code=...` hoặc endpoint lookup code | Không có trong inventory | Missing | FE hiện scan bằng cách tìm trong danh sách từ `GET /items`; inventory không có lookup theo code. | Chỉ thêm nếu cần lookup realtime. Endpoint nên là query trên `GET /items` hoặc một route lookup được document rõ. | Both | P2 |
| HIST-02 | `/history` - filter nâng cao | Lọc theo loại/ngày/item/user/search nếu UI được thêm | `GET /transactions?type=&from=&to=&itemId=&userId=&search=` | `GET /api/v1/transactions` hỗ trợ `type`, `from`, `to`, `itemId`, `page`, `limit` | Partial | BE đã hỗ trợ một phần filter implied: thiếu `userId` và `search` theo FE note. FE hiện chưa có UI/call cho filter nâng cao. | Khi làm UI filter, dùng các query đã có trước; chỉ thêm `userId`/`search` nếu thật sự cần. | Both | P2 |
| CONTRACT-01 | Mutation response chuẩn | Sau create/update/delete item/user | Standard success/entity response | BE trả entity cho create/update và `{ message }` cho delete | Unclear | FE không dùng mutation response body, chỉ refresh list. Tài liệu chưa yêu cầu chuẩn response thống nhất. | Ghi rõ contract final: create/update trả entity, delete trả `{ message }`; FE tiếp tục không phụ thuộc body nếu không cần. | Both | P2 |

## P0 Items To Fix First

Không có P0 theo tài liệu FE và source BE hiện tại. Chưa thấy gap nào làm toàn bộ FE không thể chạy nếu backend behavior đúng như source đã đọc.

Không còn mục P1 sau khi đối chiếu lại source BE và cập nhật FE. Các gap còn lại đều là P2 hoặc optional.

## Backend APIs Not Used By Frontend

| BE API | Inventory behavior | Có nên dùng ở FE? |
|---|---|---|
| `GET /health` | Health check app, không auth | Không cần trong FE app nội bộ; dùng monitoring/deploy. |
| `GET /health/db` | Health check DB, không auth | Không cần trong FE app; dùng UptimeRobot/monitoring. |
| `POST /api/v1/auth/logout-all` | Xóa toàn bộ session của user hiện tại | Chưa có UI "đăng xuất tất cả thiết bị"; có thể thêm sau nếu cần bảo mật tài khoản. |
| `GET /api/v1/items/:id` | Lấy chi tiết một item | FE hiện dùng list item đầy đủ; chưa có detail page. |
| `GET /api/v1/items/categories?action=edit|delete` | Lấy category theo quyền sửa/xóa cụ thể | FE hiện đã dùng `action=create` cho form thêm item; chưa có UI cần danh sách category theo `edit` hoặc `delete`. |
| `GET /api/v1/transactions` query `itemId`, `type`, `from`, `to` | Filter lịch sử theo item/type/date | FE history hiện chỉ dùng `page` và `limit`; có thể dùng khi thêm filter. |

## Recommended Final API Contract Outline

### Auth

| Method | Path | Request | Response chính | Notes |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | `{ username, password }` | `{ accessToken, refreshToken, expiresIn, user }` | Source BE hiện trả `user.id`, `name`, `username`, `isActive`, `role`, `permissions[]`, `allowedCategoryIds[]`. |
| `POST` | `/api/v1/auth/refresh` | `{ refreshToken }` | `{ accessToken, expiresIn }` | FE chỉ cần `accessToken`, nhưng giữ `expiresIn` ổn. |
| `POST` | `/api/v1/auth/logout` | `{ refreshToken }` + JWT | `{ message }` | Giữ như hiện tại. |
| `GET` | `/api/v1/auth/me` | JWT | `user` hiện tại | Source BE hiện reload `permissions[]` và `allowedCategoryIds[]` từ DB. |

### Items

| Method | Path | Request | Response chính | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/items` | Optional future: `search`, `page`, `limit`, `code` | `Item[]` hiện tại; nếu phân trang thì `{ data, pagination }` | Không đổi shape hiện tại khi FE vẫn đang dùng array, trừ khi phối hợp migration. |
| `GET` | `/api/v1/items/:id` | Path `id` | `Item` | Chưa dùng ở FE. |
| `GET` | `/api/v1/items/categories` | Query optional `action=view|create|edit|delete`, default `view` | `Category[]` | Source BE lọc theo `role_category_access` tương ứng với action. FE form thêm item nên gọi `action=create`. |
| `POST` | `/api/v1/items` | `{ categoryId, name, code, unit, qty?, unitPrice, minQty? }` | Created `Item` | Giữ uppercase code ở BE. |
| `PUT` | `/api/v1/items/:id` | `{ name?, unit?, unitPrice?, minQty?, isActive? }` | Updated `Item` | Giữ permission/category checks ở BE. |
| `DELETE` | `/api/v1/items/:id` | Path `id` | `{ message }` | Soft delete như hiện tại. |

### Transactions

| Method | Path | Request | Response chính | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/transactions` | `page`, `limit`, optional `itemId`, `type`, `from`, `to` | `{ data, pagination }` | Nếu thêm FE filter user/search thì BE cần thêm `userId`/`search`. |
| `POST` | `/api/v1/transactions` | `{ itemId, type, qty, note? }` | Transaction + `newQty` | Final contract nên ghi `note` required khi `type="adj"`. |
| `GET` | `/api/v1/transactions/summary` | none | Dashboard summary | Giữ filter theo category `canView`. |

### Users

| Method | Path | Request | Response chính | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/users` | none | `User[]` | BE lọc admin khỏi non-admin requester theo inventory. |
| `GET` | `/api/v1/users/roles` | none | `Role[]` | Nên quyết định endpoint trả all roles hay assignable roles theo requester. |
| `POST` | `/api/v1/users` | `{ roleId, name, username, password }` | Created `User` | BE enforce non-admin không tạo admin. |
| `PUT` | `/api/v1/users/:id` | `{ roleId?, name?, username?, password?, isActive? }` | Updated `User` | BE enforce non-admin không sửa/gán admin. |
| `DELETE` | `/api/v1/users/:id` | Path `id` | `{ message }` | Soft delete và xóa sessions như hiện tại. |
