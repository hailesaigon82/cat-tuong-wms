# Cát Tường WMS - Frontend Instructions

## Project scope

This repository is the frontend app for Cát Tường WMS. It is a Next.js 14 App Router application deployed on Vercel and connected to the Fastify backend through `NEXT_PUBLIC_API_URL`.

Treat this as an internal warehouse operations tool, not a marketing website. Prioritize fast workflows, clear Vietnamese messages, predictable navigation, and mobile usability for warehouse staff.

## Tech stack

- Next.js 14 App Router with TypeScript.
- Tailwind CSS for styling.
- Zustand for auth state.
- Browser `localStorage` for access and refresh tokens.
- `jsQR` for QR scanning.
- `qrcode` for QR generation.
- `lucide-react` for icons.

## Key files

- `src/app/layout.tsx`: root layout.
- `src/app/page.tsx`: entry redirect.
- `src/components/layout/AppShell.tsx`: authenticated app wrapper.
- `src/components/layout/Sidebar.tsx`: navigation and mobile menu.
- `src/lib/api.ts`: API client, token storage, refresh flow, friendly errors.
- `src/store/index.ts`: Zustand auth store and permission helper.
- `src/types/api.ts`: shared API response types.
- `src/components/qr/QRScanner.tsx`: camera QR scanner.
- `src/components/qr/QRGenerator.tsx`: QR renderer.

## Auth and API rules

- Use `api.get`, `api.post`, `api.put`, and `api.delete` from `src/lib/api.ts` for backend calls.
- Do not call `fetch` directly from pages or components unless there is a specific reason.
- Login uses `/auth/login` with `skipRefresh: true`.
- Session restore uses `/auth/me` from `useAppStore().hydrate()`.
- Tokens are stored as `wms_access_token` and `wms_refresh_token`.
- On expired access token, rely on the existing refresh queue in `apiFetch`; do not duplicate refresh logic in components.
- Keep error messages in Vietnamese and user-readable.
- Avoid redirect loops: auth failures should only redirect to `/login` when the user is not already on `/login`.

## Permissions and roles

The backend owns authorization. The frontend should only hide or disable UI affordances based on permissions; it must not assume that hidden UI is security.

Use `useAppStore().can(permission)` for feature-level checks. Keep permission names aligned with backend `permissions.code` values.

Roles:

- `admin`: full access.
- `manager`: management access, but not admin account management.
- `office`: view-only access, limited to category H.
- `warehouse`: inventory operations access.

Category access is backend-driven through `role_category_access`. If the backend returns `allowedCategoryIds` in `/auth/login` or `/auth/me`, preserve that field in frontend types and auth state, but continue to treat backend responses as the source of truth for filtered item lists.

## QR behavior

- User login QR should accept both `USER-admin` and `admin` style payloads.
- Item QR should accept both `ITEM-H0001` and `H0001` style payloads.
- Scanner UI must work on mobile browsers and handle camera permission errors gracefully.
- Always stop camera streams when closing scanner components or navigating away.

## UI and responsive rules

- Build the actual WMS screen first; do not add landing-page or marketing sections.
- Keep operational pages dense, clear, and scannable.
- Desktop can use tables where appropriate.
- Mobile should use card/list layouts instead of forcing wide tables.
- Preserve hamburger navigation behavior on mobile.
- Use `100dvh` or equivalent mobile-safe sizing for full-height layouts.
- Use `lucide-react` icons for icon buttons.
- Do not introduce decorative gradients, oversized hero blocks, or purely visual cards.
- Keep Vietnamese labels short and direct.

## Data and forms

- Validate obvious required fields before sending requests.
- Let backend validation remain authoritative.
- After create/update/delete or stock transactions, refresh the affected list or dashboard data.
- Preserve pagination behavior for transaction history at 20 rows per page unless the backend contract changes.
- For stock operations, support item selection by QR scan and by manual selection/search when available.

## Development workflow

- Run `npm run build` before considering frontend changes complete.
- Run `npm run lint` when linting is configured and usable.
- Keep edits scoped to the affected screen, shared component, type, or API helper.
- Do not rewrite auth or layout foundations unless the task specifically requires it.
- Do not modify `.env.local` values unless explicitly requested.

## Environment

Required frontend variable:

```bash
NEXT_PUBLIC_API_URL=https://cat-tuong-wms-backend-production.up.railway.app/api/v1
```

For local backend development, use:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```
