# Cát Tường WMS - FE/BE Gap Summary

Tài liệu này là bản compact đối chiếu `docs/fe-api-needs.md` với `docs/be-api-inventory.md`.

## Kết luận nhanh

Không còn P0/P1 gap rõ ràng giữa FE hiện tại và backend inventory.

| Status | Count | Ý nghĩa |
|---|---:|---|
| Match | 30 | Contract đang khớp và FE có thể dùng trực tiếp. |
| Partial | 2 | BE có phần lớn contract, nhưng UI hiện chưa phụ thuộc đầy đủ. |
| Monitor | 4 | Chạy được hiện tại, cần theo dõi nếu nghiệp vụ/quyền mở rộng. |
| Mismatch | 0 | Không còn lệch contract đã biết. |
| Missing | 0 | Không có endpoint bắt buộc đang thiếu cho FE hiện tại. |

## Gap còn đáng chú ý

| ID | Mức | Loại | Nội dung | Hướng xử lý |
|---|---|---|---|---|
| DASH-01 | P3 | Partial | BE có `GET /transactions/summary`, nhưng FE dashboard chưa render KPI đầy đủ. | Khi làm dashboard thật, dùng endpoint hiện có. |
| HIST-04 | P3 | Partial | UI chưa có filter history theo `userId`/`search`; BE inventory chưa có hai query này. | Chỉ bổ sung nếu UI cần tra cứu nâng cao. |
| TX-ACTION-CAT | P2 | Monitor | Transaction forms chọn item theo `GET /items`, tức đang dựa trên `canView` + permission transaction global. | Nếu quyền nhập/xuất/điều chỉnh tách theo category, cần API/field thể hiện quyền thao tác từng item/category. |
| AUTH-SEC | P3 | Tech debt | FE token nằm trong `sessionStorage`, tốt hơn persistence của `localStorage` nhưng vẫn đọc được bởi JS. | Nếu cần harden security, cân nhắc HttpOnly cookie/session design. |

## Các gap đã đóng

| Trước đây | Trạng thái hiện tại |
|---|---|
| History dùng `limit=20` không đồng nhất | FE dùng `limit=50` cho cả xuất nhập và điều chỉnh. |
| Form history chung nhưng type query chưa rõ | Xuất nhập dùng `types=in,out`; điều chỉnh dùng `type=adj`. |
| `note` transaction còn optional/unclear | FE contract hiện là `note: string` cho nhập, xuất, điều chỉnh. |
| Popular tab cần count từ toàn bộ transaction history | BE có `items.numOfTrans`; FE dùng `/items/popular` và không tự crawl history. |
| FE còn dùng/fallback `transactionCount` | Đã bỏ; cột số giao dịch dùng `numOfTrans`. |
| Category dropdown chưa action-specific | FE dùng `action=create/edit/delete` theo từng flow. |
| Login request có thể dính refresh/auth interceptor | Login gọi với `{ skipAuth: true, skipRefresh: true }`. |
| Token lưu persistent trong `localStorage` | FE chuyển sang `sessionStorage` và clear legacy localStorage keys. |

## Contract final FE đang phụ thuộc

### Auth

| FE need | BE endpoint | Status |
|---|---|---|
| Login token + user + permissions + `allowedCategoryIds` | `POST /api/v1/auth/login` | Match |
| Hydrate current user | `GET /api/v1/auth/me` | Match |
| Refresh access token | `POST /api/v1/auth/refresh` | Match |
| Logout current session | `POST /api/v1/auth/logout` | Match |
| Change password | `POST /api/v1/auth/change-password` | Match |

### Items

| FE need | BE endpoint | Status |
|---|---|---|
| Item list gồm `numOfTrans` | `GET /api/v1/items` | Match |
| Search dropdown | `GET /api/v1/items?search=&limit=20` | Match |
| QR/code lookup | `GET /api/v1/items?code=` | Match |
| Popular top 30 hương liệu | `GET /api/v1/items/popular?limit=30&categoryCodes=R,N` | Match |
| Recompute `numOfTrans` | `POST /api/v1/items/recompute-transaction-counts` | Match; FE chỉ hiện nút cho username `hai`, BE vẫn admin-only |
| Category theo action | `GET /api/v1/items/categories?action=create|edit|delete` | Match |
| Create/update/delete item | `POST`, `PUT`, `DELETE /api/v1/items` | Match |

### Transactions và History

| FE need | BE endpoint | Status |
|---|---|---|
| Nhập kho | `POST /api/v1/transactions`, `type="in"` | Match |
| Xuất kho | `POST /api/v1/transactions`, `type="out"` | Match |
| Điều chỉnh | `POST /api/v1/transactions`, `type="adj"` | Match |
| History xuất nhập | `GET /api/v1/transactions?limit=50&page=&types=in,out` | Match |
| History điều chỉnh | `GET /api/v1/transactions?limit=50&page=&type=adj` | Match |
| Date filter | `GET /api/v1/transactions?from=&to=` | Match |
| Reverse transaction | `POST /api/v1/transactions/:id/reverse` | Available, FE chưa dùng |

### Users

| FE need | BE endpoint | Status |
|---|---|---|
| User list | `GET /api/v1/users` | Match |
| Role dropdown | `GET /api/v1/users/roles` | Match |
| Create/update/delete user | `POST`, `PUT`, `DELETE /api/v1/users` | Match |

## Backend API chưa dùng ở FE

| API | Ghi chú |
|---|---|
| `GET /health`, `GET /health/db` | Dùng monitoring/deploy, không cần trong app FE. |
| `POST /api/v1/auth/logout-all` | Có thể thêm UI “đăng xuất tất cả thiết bị” sau. |
| `GET /api/v1/items/:id` | Chưa có item detail page. |
| `POST /api/v1/transactions/:id/reverse` | BE có sẵn, FE chưa có UI reverse. |
