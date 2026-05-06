# Inventory API Backend

Tài liệu này được scan từ các handler Fastify trong `src/app.ts` và `src/routes/*.ts`.

Ghi chú chung:

- Các endpoint trong `src/routes/*.ts` được mount dưới prefix `/api/v1`.
- Các endpoint `/health` và `/health/db` nằm ngoài prefix `/api/v1`.
- Auth nếu có `onRequest: [fastify.authenticate]` nghĩa là yêu cầu JWT access token hợp lệ.
- Permission nếu có `preHandler` được ghi theo permission code trong code.
- Response shape là suy luận từ object được `send()` trong handler, không phải OpenAPI schema chính thức.

## Tổng Quan Endpoint

| Method | Path | File | Auth |
|---|---|---|---|
| GET | `/health` | `src/app.ts` | Không |
| GET | `/health/db` | `src/app.ts` | Không |
| POST | `/api/v1/auth/login` | `src/routes/auth.ts` | Không |
| POST | `/api/v1/auth/refresh` | `src/routes/auth.ts` | Không |
| POST | `/api/v1/auth/logout` | `src/routes/auth.ts` | JWT |
| POST | `/api/v1/auth/logout-all` | `src/routes/auth.ts` | JWT |
| GET | `/api/v1/auth/me` | `src/routes/auth.ts` | JWT |
| GET | `/api/v1/items` | `src/routes/items.ts` | JWT + `view_items` |
| GET | `/api/v1/items/:id` | `src/routes/items.ts` | JWT + `view_items` |
| POST | `/api/v1/items` | `src/routes/items.ts` | JWT + `create_items` |
| PUT | `/api/v1/items/:id` | `src/routes/items.ts` | JWT + `edit_items` |
| DELETE | `/api/v1/items/:id` | `src/routes/items.ts` | JWT + `delete_items` |
| GET | `/api/v1/items/categories` | `src/routes/items.ts` | JWT |
| GET | `/api/v1/transactions` | `src/routes/transactions.ts` | JWT + `view_history` |
| POST | `/api/v1/transactions` | `src/routes/transactions.ts` | JWT + one of `tx_in`, `tx_out`, `tx_adj`; then exact tx permission |
| GET | `/api/v1/transactions/summary` | `src/routes/transactions.ts` | JWT + `view_dashboard` |
| GET | `/api/v1/users/roles` | `src/routes/users.ts` | JWT |
| GET | `/api/v1/users` | `src/routes/users.ts` | JWT + `manage_users` |
| POST | `/api/v1/users` | `src/routes/users.ts` | JWT + `manage_users` |
| PUT | `/api/v1/users/:id` | `src/routes/users.ts` | JWT + `manage_users` |
| DELETE | `/api/v1/users/:id` | `src/routes/users.ts` | JWT + `manage_users` |

## Chi Tiết Endpoint

### GET `/health`

- Handler file: `src/app.ts`
- Auth: không yêu cầu.
- Path params: không có.
- Query params: không có.
- Request body: không có.
- Response shape:

```ts
{
  status: "ok";
  timestamp: string;
  env: string | undefined;
}
```

- Notes/uncertainties: endpoint dùng cho health check app, không kiểm tra DB.

### GET `/health/db`

- Handler file: `src/app.ts`
- Auth: không yêu cầu.
- Path params: không có.
- Query params: không có.
- Request body: không có.
- Response shape:

```ts
// 200
{ status: "ok"; db: "connected" }

// 503
{ status: "error"; db: "disconnected" }
```

- Notes/uncertainties: dùng `$queryRaw` với `SELECT 1`; được comment là dùng cho UptimeRobot để giữ Neon không suspend.

### POST `/api/v1/auth/login`

- Handler file: `src/routes/auth.ts`
- Auth: không yêu cầu.
- Path params: không có.
- Query params: không có.
- Request body:

```ts
{
  username: string;
  password: string;
}
```

- Response shape:

```ts
{
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: number;
    name: string;
    username: string;
    isActive: boolean;
    role: {
      id: number;
      code: string;
      name: string;
    };
    permissions: string[];
    allowedCategoryIds: number[];
  };
}
```

- Error shape có thể có:

```ts
{
  error: "Unauthorized";
  message: string;
}
```

- Notes/uncertainties: body schema có `additionalProperties: true`. Access token có payload gồm `userId`, `roleId`, `roleCode`, `permissions`, `allowedCategoryIds`.

### POST `/api/v1/auth/refresh`

- Handler file: `src/routes/auth.ts`
- Auth: không yêu cầu access token; yêu cầu refresh token trong body.
- Path params: không có.
- Query params: không có.
- Request body:

```ts
{
  refreshToken: string;
}
```

- Response shape:

```ts
{
  accessToken: string;
  expiresIn: string;
}
```

- Error shape có thể có:

```ts
{
  error: "Unauthorized";
  message: string;
}
```

- Notes/uncertainties: refresh token được lookup trong bảng `sessions`. Nếu session hết hạn thì xóa session đó. Nếu user bị deactivate thì trả 401 nhưng không xóa session trong handler này.

### POST `/api/v1/auth/logout`

- Handler file: `src/routes/auth.ts`
- Auth: JWT qua `fastify.authenticate`.
- Path params: không có.
- Query params: không có.
- Request body:

```ts
{
  refreshToken: string;
}
```

- Response shape:

```ts
{
  message: "Đăng xuất thành công";
}
```

- Notes/uncertainties: xóa session theo `refreshToken` và `request.user.userId`; nếu token không match session nào vẫn trả 200.

### POST `/api/v1/auth/logout-all`

- Handler file: `src/routes/auth.ts`
- Auth: JWT qua `fastify.authenticate`.
- Path params: không có.
- Query params: không có.
- Request body: không có schema/body được khai báo.
- Response shape:

```ts
{
  message: string;
}
```

- Notes/uncertainties: xóa tất cả session của `request.user.userId`; message chứa số thiết bị/session đã xóa.

### GET `/api/v1/auth/me`

- Handler file: `src/routes/auth.ts`
- Auth: JWT qua `fastify.authenticate`.
- Path params: không có.
- Query params: không có.
- Request body: không có.
- Response shape:

```ts
{
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  role: {
    id: number;
    code: string;
    name: string;
  };
  permissions: string[];
  allowedCategoryIds: number[];
}
```

- Error shape có thể có:

```ts
{
  error: "User not found";
}
```

- Notes/uncertainties: user được lookup từ DB; `permissions` và `allowedCategoryIds` được reload từ DB tại thời điểm gọi `/auth/me`.

### GET `/api/v1/items`

- Handler file: `src/routes/items.ts`
- Auth: JWT + permission `view_items`.
- Path params: không có.
- Query params:

```ts
{
  search?: string;     // tìm gần đúng theo code hoặc name, case-insensitive
  q?: string;          // alias của search
  code?: string;       // lookup chính xác theo code, BE uppercase trước khi so sánh
  categoryId?: string; // số nguyên dương, vẫn bị giới hạn bởi role_category_access.canView
  page?: string;       // số nguyên dương, default 1 khi có limit/filter
  limit?: string;      // số nguyên dương, cap tối đa 100
}
```

- Request body: không có.
- Response shape:

```ts
Array<{
  id: number;
  categoryId: number;
  name: string;
  code: string;
  unit: string;
  qty: number;
  unitPrice: number;
  minQty: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  category: {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    isActive: boolean;
  };
}>
```

- Notes/uncertainties: lọc item theo `role_category_access.canView` và `isActive: true`; sort theo `code asc`. Request cũ `GET /items` vẫn trả toàn bộ array như trước. Khi có query filter/search mà không truyền `limit`, BE mặc định giới hạn 50 item; dropdown nên gọi `GET /items?search=<term>&limit=20` với debounce 250-400ms.

### GET `/api/v1/items/:id`

- Handler file: `src/routes/items.ts`
- Auth: JWT + permission `view_items`.
- Path params:

```ts
{
  id: string; // parseInt sang number
}
```

- Query params: không có.
- Request body: không có.
- Response shape: một item giống phần tử của `GET /api/v1/items`.
- Error shape có thể có:

```ts
{
  error: "Not Found";
  message: string;
}
```

- Notes/uncertainties: có params schema yêu cầu `id` là chuỗi số nguyên dương.

### POST `/api/v1/items`

- Handler file: `src/routes/items.ts`
- Auth: JWT + permission `create_items`; thêm kiểm tra `role_category_access.canCreate` cho `categoryId`.
- Path params: không có.
- Query params: không có.
- Request body:

```ts
{
  categoryId: number;
  name: string;
  code: string;
  unit: string;
  qty?: number;       // default 0
  unitPrice: number;
  minQty?: number;    // default 0
}
```

- Response shape: item vừa tạo kèm `category`.
- Error shape có thể có:

```ts
// 403
{ error: "Forbidden"; message: string }

// 409
{ error: "Conflict"; message: string }
```

- Notes/uncertainties: code được uppercase trước khi lưu; body schema có `additionalProperties: true`.

### PUT `/api/v1/items/:id`

- Handler file: `src/routes/items.ts`
- Auth: JWT + permission `edit_items`; thêm kiểm tra `role_category_access.canEdit` theo category hiện tại của item.
- Path params:

```ts
{
  id: string; // parseInt sang number
}
```

- Query params: không có.
- Request body:

```ts
{
  name?: string;
  unit?: string;
  unitPrice?: number;
  minQty?: number;
  isActive?: boolean;
}
```

- Response shape: item sau update kèm `category`.
- Error shape có thể có:

```ts
// 404
{ error: "Not Found"; message: string }

// 403
{ error: "Forbidden"; message: string }
```

- Notes/uncertainties: body schema có `additionalProperties: true`, nhưng handler whitelist field trước khi truyền vào Prisma `data`.

### DELETE `/api/v1/items/:id`

- Handler file: `src/routes/items.ts`
- Auth: JWT + permission `delete_items`; thêm kiểm tra `role_category_access.canDelete` theo category hiện tại của item.
- Path params:

```ts
{
  id: string; // parseInt sang number
}
```

- Query params: không có.
- Request body: không có.
- Response shape:

```ts
{
  message: string;
}
```

- Error shape có thể có:

```ts
// 404
{ error: "Not Found"; message: string }

// 403
{ error: "Forbidden"; message: string }
```

- Notes/uncertainties: soft delete bằng `isActive: false`, không xóa record thật.

### GET `/api/v1/items/categories`

- Handler file: `src/routes/items.ts`
- Auth: JWT qua `fastify.authenticate`.
- Path params: không có.
- Query params:

```ts
{
  action?: "view" | "create" | "edit" | "delete"; // default "view"
}
```

- Request body: không có.
- Response shape:

```ts
Array<{
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}>
```

- Notes/uncertainties: lọc category active theo `role_category_access` tương ứng với `action`: `view -> canView`, `create -> canCreate`, `edit -> canEdit`, `delete -> canDelete`.

### GET `/api/v1/transactions`

- Handler file: `src/routes/transactions.ts`
- Auth: JWT + permission `view_history`.
- Path params: không có.
- Query params:

```ts
{
  itemId?: string; // parseInt sang number nếu có
  type?: string;   // không có schema enum ở query
  from?: string;   // new Date(from)
  to?: string;     // new Date(to)
  page?: string;   // default "1", số nguyên dương
  limit?: string;  // default "50", số nguyên dương, cap tối đa 100
}
```

- Request body: không có.
- Response shape:

```ts
{
  data: Array<{
    id: number;
    itemId: number;
    userId: number;
    type: "in" | "out" | "adj";
    qty: number;
    unitPrice: number;
    totalPrice: number;
    note?: string | null;
    createdAt: string | Date;
    item: {
      id: number;
      categoryId: number;
      name: string;
      code: string;
      unit: string;
      qty: number;
      unitPrice: number;
      minQty: number;
      isActive: boolean;
      createdAt: string | Date;
      updatedAt: string | Date;
      category: object;
    };
    user: {
      id: number;
      name: string;
      username: string;
    };
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

- Error shape có thể có:

```ts
{
  error: "Forbidden";
  message: string;
}
```

- Notes/uncertainties: lọc theo item thuộc category có `canView`. Query params có schema validation cho `itemId`, `type`, `page`, `limit`; `from` và `to` vẫn được parse bằng `new Date(...)`.

### POST `/api/v1/transactions`

- Handler file: `src/routes/transactions.ts`
- Auth: JWT + một trong các permission `tx_in`, `tx_out`, `tx_adj`; trong handler kiểm tra chính xác permission theo `type`.
- Path params: không có.
- Query params: không có.
- Request body:

```ts
{
  itemId: number;
  type: "in" | "out" | "adj";
  qty: number;     // minimum 1
  note?: string;
}
```

- Response shape:

```ts
{
  id: number;
  itemId: number;
  userId: number;
  type: "in" | "out" | "adj";
  qty: number;
  unitPrice: number;
  totalPrice: number;
  note?: string | null;
  createdAt: string | Date;
  item: object;
  user: {
    id: number;
    name: string;
  };
  newQty: number;
}
```

- Error shape có thể có:

```ts
// 403
{ error: "Forbidden"; message: string }

// 404
{ error: "Not Found"; message: string }

// 400
{ error: "Bad Request"; message: string }
```

- Notes/uncertainties: item access đang kiểm theo `canView`, không theo action-specific category flag. Với `type: "adj"`, `note` bắt buộc ở runtime. Với `type: "out"`, kiểm tra không cho xuất vượt tồn kho hiện tại. Stock mutation dùng Prisma transaction và conditional update để tránh race condition xuất kho.

### GET `/api/v1/transactions/summary`

- Handler file: `src/routes/transactions.ts`
- Auth: JWT + permission `view_dashboard`.
- Path params: không có.
- Query params: không có.
- Request body: không có.
- Response shape:

```ts
{
  totalItems: number;
  totalInventoryValue: number;
  todayTransactions: number;
  lowStockCount: number;
  lowStockItems: Array<{
    id: number;
    name: string;
    code: string;
    unit: string;
    qty: number;
    unitPrice: number;
    minQty: number;
    categoryId: number;
    isActive: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
    category: {
      id: number;
      code: string;
      name: string;
    };
  }>;
}
```

- Notes/uncertainties: dữ liệu dashboard lọc theo category `canView`. Low-stock dùng raw SQL và map thủ công.

### GET `/api/v1/users/roles`

- Handler file: `src/routes/users.ts`
- Auth: JWT qua `fastify.authenticate`.
- Path params: không có.
- Query params: không có.
- Request body: không có.
- Response shape:

```ts
Array<{
  id: number;
  code: string;
  name: string;
}>
```

- Notes/uncertainties: route này được đăng ký trong `usersRoutes`. File cũng export `registerUsersExtra()` có route cùng path nhưng hàm đó không được register trong `src/app.ts`, nên không tính là endpoint runtime hiện tại.

### GET `/api/v1/users`

- Handler file: `src/routes/users.ts`
- Auth: JWT + permission `manage_users`.
- Path params: không có.
- Query params: không có.
- Request body: không có.
- Response shape:

```ts
Array<{
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  createdAt: string | Date;
  role: {
    id: number;
    code: string;
    name: string;
  };
}>
```

- Notes/uncertainties: nếu requester không phải `roleCode === "admin"` thì danh sách loại role `admin`.

### POST `/api/v1/users`

- Handler file: `src/routes/users.ts`
- Auth: JWT + permission `manage_users`.
- Path params: không có.
- Query params: không có.
- Request body:

```ts
{
  roleId: number;
  name: string;
  username: string;
  password: string;
}
```

- Response shape:

```ts
{
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  role: {
    id: number;
    code: string;
    name: string;
  };
}
```

- Error shape có thể có:

```ts
// 403
{ error: "Forbidden"; message: string }

// 409
{ error: "Conflict"; message: string }
```

- Notes/uncertainties: non-admin không được tạo user role admin. Password được hash bằng bcrypt trước khi lưu.

### PUT `/api/v1/users/:id`

- Handler file: `src/routes/users.ts`
- Auth: JWT + permission `manage_users`.
- Path params:

```ts
{
  id: string; // parseInt sang number
}
```

- Query params: không có.
- Request body:

```ts
{
  roleId?: number;
  name?: string;
  username?: string;
  password?: string;
  isActive?: boolean;
}
```

- Response shape:

```ts
{
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  role: {
    id: number;
    code: string;
    name: string;
  };
}
```

- Error shape có thể có:

```ts
// 404
{ error: "Not Found"; message: string }

// 403
{ error: "Forbidden"; message: string }
```

- Notes/uncertainties: non-admin không được sửa user admin hoặc gán role admin. Đổi username, đổi role hoặc deactivate sẽ xóa sessions.

### DELETE `/api/v1/users/:id`

- Handler file: `src/routes/users.ts`
- Auth: JWT + permission `manage_users`.
- Path params:

```ts
{
  id: string; // parseInt sang number
}
```

- Query params: không có.
- Request body: không có.
- Response shape:

```ts
{
  message: string;
}
```

- Error shape có thể có:

```ts
// 400
{ error: "Bad Request"; message: string }

// 404
{ error: "Not Found"; message: string }

// 403
{ error: "Forbidden"; message: string }
```

- Notes/uncertainties: không cho tự xóa chính mình. Non-admin không được xóa user admin. Thực tế là soft delete bằng `isActive: false`, sau đó xóa sessions của target user.

## Error Shape Chung

Global error handler trong `src/app.ts` có thể trả:

```ts
// validation error
{
  error: "Bad Request";
  message: "Dữ liệu không hợp lệ";
  details: unknown;
}

// known Fastify/statusCode error
{
  error: string;
  message: string;
}

// unexpected error
{
  error: "Internal Server Error";
  message: string;
}

// not found route
{
  error: "Not Found";
  message: string;
}
```
