# Cát Tường WMS - FE/BE Gap Summary

Bản compact các điểm FE cần theo dõi so với contract BE đang dùng. FE repo không lưu inventory chi tiết của BE; khi cần xác minh route/schema thật thì đọc trực tiếp BE repo.

## Kết Luận Nhanh

Không có P0/P1 mismatch đã biết giữa FE hiện tại và BE.

| Status | Count | Ý nghĩa |
|---|---:|---|
| Match | 36 | Contract FE cần đã có và đang khớp. |
| Partial | 1 | BE có endpoint/capability, nhưng FE chưa dùng hết. |
| Monitor | 1 | Chạy được hiện tại, cần theo dõi nếu nghiệp vụ mở rộng. |
| Tech debt | 1 | Không lệch contract nhưng còn hướng hardening. |
| Workflow | 1 | Quy ước làm việc để tránh drift tài liệu. |
| Mismatch | 0 | Không có lệch contract đã biết. |
| Missing | 0 | Không thiếu endpoint FE bắt buộc. |

## Gap Hiện Tại

| ID | Mức | Loại | Nội dung | Hướng xử lý |
|---|---|---|---|---|
| DASH-01 | P3 | Partial | BE có `GET /transactions/summary`, nhưng FE dashboard vẫn tối giản. | Khi làm KPI dashboard, dùng endpoint hiện có. |
| TX-ACTION-CAT | P2 | Monitor | Transaction form chọn item qua `GET /items`, dựa vào `canView` + permission transaction global. | Nếu quyền transaction tách theo category, cần contract action theo item/category. |
| AUTH-SEC | P3 | Tech debt | Token nằm trong `sessionStorage`; vẫn đọc được bởi JS nếu có XSS. | Cân nhắc HttpOnly cookie/session nếu cần hardening mạnh hơn. |
| DOC-SYNC | P2 | Workflow | FE docs dễ drift nếu sửa UI nhưng không cập nhật tài liệu. | Đã thêm rule: khi đổi FE, cập nhật document FE liên quan trong cùng session. |

## Gap Vừa Đóng

| Chủ đề | Trạng thái hiện tại |
|---|---|
| Setting Ẩn tồn kho | FE có màn admin **Cài đặt**, `GET /settings`, `PATCH /settings/hide-stock`, và render `NA` cho stock hidden/null. |
| Nullable stock fields | `ApiItem.qty`, `ApiItem.minQty`, transaction `stockBefore`, `newQty` đã hỗ trợ `null`. |
| History limit | FE dùng `limit=50` cho xuất/nhập và điều chỉnh. |
| History type query | Xuất/nhập dùng `types=in,out`; điều chỉnh dùng `type=adj`. |
| Transaction note | FE gửi `note` cho in/out/adj. |
| Popular item count | FE dùng `items.numOfTrans` và `/items/popular`, không crawl history. |
| Category dropdown | FE dùng `action=create/edit/delete`. |
| Login auth interceptor | Login gọi `{ skipAuth: true, skipRefresh: true }`. |
| Persistent token storage | FE chuyển từ `localStorage` sang `sessionStorage` và clear legacy keys. |
| FE/BE type cleanup | `ApiCategory.description`, `ApiTransaction.user.username`, reverse `newQty`, và categories create permission call đã khớp BE hơn. |

## Contract Map

### Auth

| FE cần | BE endpoint | Status |
|---|---|---|
| Login token + user + permissions + `allowedCategoryIds` | `POST /api/v1/auth/login` | Match |
| Hydrate current user | `GET /api/v1/auth/me` | Match |
| Refresh access token | `POST /api/v1/auth/refresh` | Match |
| Logout current session | `POST /api/v1/auth/logout` | Match |
| Change password | `POST /api/v1/auth/change-password` | Match |

### Settings

| FE cần | BE endpoint | Status |
|---|---|---|
| Đọc trạng thái Ẩn tồn kho | `GET /api/v1/settings` | Match |
| Toggle Ẩn tồn kho | `PATCH /api/v1/settings/hide-stock` | Match |
| Hiển thị stock hidden | Item/transaction response có `stockHidden` và stock `null` | Match |

### Items

| FE cần | BE endpoint | Status |
|---|---|---|
| Item list có `numOfTrans` và nullable stock fields | `GET /api/v1/items` | Match |
| Search dropdown | `GET /api/v1/items?search=&limit=20` | Match |
| QR/code lookup | `GET /api/v1/items?code=` | Match |
| Popular top 30 hương liệu | `GET /api/v1/items/popular?limit=30&categoryCodes=R,N` | Match |
| Recompute `numOfTrans` | `POST /api/v1/items/recompute-transaction-counts` | Match; FE chỉ hiện cho username `hai`, BE admin-only |
| Category theo action | `GET /api/v1/items/categories?action=create\|edit\|delete` | Match |
| Tạo/sửa/xóa item | `POST`, `PUT`, `DELETE /api/v1/items` | Match |

### Transactions Và History

| FE cần | BE endpoint | Status |
|---|---|---|
| Tạo transaction in/out/adj | `POST /api/v1/transactions` | Match |
| Nhận `newQty` đã mask | `POST /api/v1/transactions` response | Match |
| Thu hồi giao dịch cuối | `POST /api/v1/transactions/:id/reverse` | Match |
| History xuất/nhập | `GET /api/v1/transactions?limit=50&page=&types=in,out` | Match |
| History điều chỉnh | `GET /api/v1/transactions?limit=50&page=&type=adj` | Match |
| Date filter | `GET /api/v1/transactions?from=&to=` | Match |

### Users

| FE cần | BE endpoint | Status |
|---|---|---|
| User list | `GET /api/v1/users` | Match |
| Role dropdown | `GET /api/v1/users/roles` | Match |
| Tạo/sửa/xóa user | `POST`, `PUT`, `DELETE /api/v1/users` | Match |
