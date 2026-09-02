# Plan: Register Flow, Welcome Dashboard, & Landing Page

**Created:** 2026-09-02  
**Status:** Implementation-ready  
**Scope:** Three interconnected features for user onboarding and home experience

---

## 1. User Requirements Summary

| Requirement | Decision |
|---|---|
| Register flow | Public self-registration; new users start with `authenticated` role (read-only) |
| User activation | Admin activates & assigns role via existing user management page |
| Password setup | User sets password during registration |
| Welcome dashboard | Role-based, replaces `/inspections` as default landing after login |
| Metrics per role | Supplier (work count), Admin (system health), Manager (aggregated reports), Operator (ops monitoring) |
| Landing page | Public (unauthenticated) + authenticated welcome dashboard; built in React + Tailwind |
| Default redirect | `/login` → (after auth) → `/welcome` (role-based welcome dashboard, not `/inspections`) |

---

## 2. Architecture Overview

### 2.1 Database Changes
No schema changes required. Use existing:
- `users` table with `role`, `is_active`, `password_hash`
- `submissions` table for supplier metrics
- `audit_logs` table for admin metrics
- `user_regions` for region data (already in use)

### 2.2 API Endpoints

#### New Endpoints

| Method | Route | Purpose | Auth | Return |
|---|---|---|---|---|
| POST | `/api/auth/register` | User self-registration | None | `{ user: CurrentUser, session: Session }` |
| GET | `/api/dashboard/metrics` | Get dashboard metrics based on role | Yes | Role-specific metrics object |

#### Existing Endpoints (No changes)
- `POST /api/auth/login` — keep as-is
- `POST /api/users` — admin creates users (already exists)
- `GET /api/auth/me` — session validation (already exists)

### 2.3 Frontend Routes

| Route | Component | Auth | Purpose |
|---|---|---|---|
| `/` | LandingPage (public) | None | Public landing with info + login CTA |
| `/login` | LoginPage (existing) | None | Keep existing login |
| `/register` | RegisterPage (new) | None | Public registration form |
| `/welcome` | WelcomeDashboard (new) | Yes | Role-based welcome + metrics |
| `/*` | AppShell routes (existing) | Yes | All authenticated app routes |

**Default redirect logic:**
- Unauthenticated at `/` → show landing page
- Unauthenticated at any `/something` → redirect to `/login` (with `from` state preserved)
- Authenticated at `/` → redirect to `/welcome`
- Authenticated at `/login` or `/register` → redirect to `/welcome`

---

## 3. Implementation Tasks

### Phase 1: Backend — Registration Endpoint

**File:** `apps/api/src/modules/auth/auth-service.ts`

1. Create `register()` function:
   - Input: `{ username, displayName, password, confirmPassword, email? }`
   - Validation:
     - Username: 3-20 chars, alphanumeric + underscore, case-insensitive check against `users` table
     - Password: min 10 chars (existing Argon2id rules from §04)
     - Display name: 2-100 chars
   - Logic:
     - Hash password with Argon2id
     - Create user with `role = 'authenticated'`, `is_active = true`, `must_change_password = false`
     - Create session (reuse existing session creation logic)
     - Return `{ user: CurrentUser, session }` for immediate login
   - Errors:
     - `DUPLICATE_USERNAME` if username already exists (case-insensitive)
     - `WEAK_PASSWORD` if password fails rules
     - `INVALID_INPUT` for validation failures
   - Audit: log `user.created` with registration context

2. Create Zod schema: `registerSchema` in `@c26/contracts/src/auth.ts`

**File:** `apps/api/src/modules/auth/routes.ts`

3. Register route handler:
   ```
   POST /api/auth/register
   - Public (no auth required)
   - Rate limit: 5 per 15 min per IP (anti-spam)
   - Body: registerSchema
   - Response: { user: CurrentUser, session }
   - Sets session cookies like login does
   ```

### Phase 2: Backend — Dashboard Metrics Endpoint

**File:** `apps/api/src/modules/dashboard/` (new directory)

1. Create `dashboard-service.ts`:
   - Function `getMetricsForRole(actor: Actor): Promise<DashboardMetrics>`
   - Role-specific metrics:

     **Supplier:**
     ```typescript
     {
       type: 'supplier'
       submissionCounts: {
         draft: number
         pending_qc: number
         needs_revision: number
         passed_qc: number
         dropped_qc: number
       }
       lastSubmission?: { sn: string; submittedAt: Date }
       uploadQueueStatus: { pending: number; errors: number }
     }
     ```

     **Admin:**
     ```typescript
     {
       type: 'admin'
       systemHealth: {
         totalUsers: number
         activeUsers: number
         usersByRole: Record<UserRole, number>
       }
       submissionStats: {
         totalSubmissions: number
         byStatus: Record<SubmissionStatus, number>
         thisMonth: number
         thisMonthByCategory: { TB: number; LT: number }
       }
       recentAuditEvents: Array<{
         timestamp: Date
         action: string
         actor: string
         entity: string
       }>
     }
     ```

     **Manager:**
     ```typescript
     {
       type: 'manager'
       reportingMetrics: {
         byRegion: Array<{ region: string; TB: number; LT: number }>
         byCategory: { TB: number; LT: number }
         thisMonth: number
         trend: Array<{ month: string; count: number }>
       }
     }
     ```

     **Operator:**
     ```typescript
     {
       type: 'operator'
       jobQueueStatus: {
         pending: number
         processing: number
         failed: number
         lastError?: string
       }
       systemHealth: {
         uptime: number
         errorRate: number
       }
       recentLogs: Array<{ timestamp: Date; level: string; message: string }>
     }
     ```

2. Create `routes.ts`:
   ```
   GET /api/dashboard/metrics
   - Requires auth
   - Returns metrics based on actor.role
   ```

3. Update contracts: define TypeScript types for each metric response

### Phase 3: Frontend — Landing Page

**File:** `apps/web/src/features/landing/landing-page.tsx` (new)

1. Create public landing page:
   - Hero section: company name, tagline, CTA ("Mulai Sekarang")
   - Features section: 4-5 key features with icons
   - Benefits section: why use this system
   - Screenshots/mockups: inspection flow, dashboard preview
   - Footer: contact info, links
   - CTA buttons: "Login" → `/login`, "Daftar" → `/register`
   - No auth required; no AppShell
   - Responsive design (mobile-first)

### Phase 4: Frontend — Registration Page

**File:** `apps/web/src/features/auth/register-page.tsx` (new)

1. Create registration form:
   - Fields: username, displayName, password, confirmPassword
   - Validation:
     - Real-time feedback for username (availability check debounced)
     - Password strength indicator
     - Confirm password match check
   - Submit:
     - POST `/api/auth/register`
     - On success: attach session cookies, redirect to `/welcome`
     - On error: show error banner (DUPLICATE_USERNAME, WEAK_PASSWORD, etc.)
   - Link: "Sudah punya akun? Masuk di sini" → `/login`
   - Styling: match LoginPage aesthetic

### Phase 5: Frontend — Welcome Dashboard

**File:** `apps/web/src/features/welcome/welcome-page.tsx` (new)

1. Create role-based welcome dashboard:
   - Fetch `/api/dashboard/metrics` on mount
   - Render role-specific layout:

     **Supplier:**
     - Welcome greeting: "Selamat datang, [name]"
     - Submission status cards: draft, pending, passed, etc. with counts
     - Quick action: "Buat Pengajuan Baru" button
     - Last submission widget: SN, date, status
     - Upload queue preview
     - Quick links to inspections list

     **Admin:**
     - System health card: active users, total submissions
     - User breakdown by role (pie/bar chart using existing chart lib)
     - Recent audit events table (last 10 events)
     - Quick links: user management, QC queue, reports
     - Submission stats by category (TB vs LT)

     **Manager:**
     - Regional breakdown card: TB/LT counts per region
     - This month summary: total submissions, chart
     - Trend sparkline: submissions over past 6 months
     - Quick link to reports/export

     **Operator:**
     - Job queue status card
     - System health indicator (uptime, error rate)
     - Recent error logs table
     - Quick links: ops monitoring, job retry

   - All use existing Tailwind + component library
   - Loading state: skeleton cards while fetching
   - Error state: retry button

### Phase 6: Frontend — Routing & Navigation

**File:** `apps/web/src/App.tsx`

1. Update routing:
   - Add `/` route → `<LandingPage />` (public)
   - Add `/register` route → `<RegisterPage />` (public)
   - Add `/welcome` route → `<WelcomeDashboard />` (authenticated)
   - Change index route in authenticated area: `/` → `/welcome` (not `/inspections`)

2. Update `RequireSession` logic:
   - If unauthenticated and at `/`, show landing page (do not redirect)
   - If unauthenticated and at any other path, redirect to `/login` with state
   - If authenticated and at `/login` or `/register`, redirect to `/welcome`
   - If authenticated and at `/`, redirect to `/welcome`

3. Update sidebar navigation:
   - First menu item: "Dashboard" → `/welcome` (for all roles)
   - Keep existing menu items below

### Phase 7: User Flow — Activation

No new endpoint needed. Use existing user management:
1. Admin logs in → `/users` page
2. Finds newly registered user with `role='authenticated'`
3. Clicks edit → changes `role` to `supplier`, `admin`, `manager`, or `operator`
4. Saves → user can now access features for that role
5. Admin can also toggle `is_active` to deactivate without deleting

---

## 4. Data Flow Diagrams

### Registration Flow
```
User at /register
  ↓
Fills form (username, name, password)
  ↓
POST /api/auth/register
  ↓
Backend: validate, hash password, create user (role='authenticated'), create session
  ↓
Attach session cookies
  ↓
Redirect to /welcome
  ↓
User lands on welcome dashboard (minimal permissions as 'authenticated')
  ↓
Admin later: edit user, change role to 'supplier' (or other)
  ↓
User logs in next time → sees role-appropriate dashboard
```

### Dashboard Metrics Flow
```
User authenticates
  ↓
Lands on /welcome
  ↓
WelcomeDashboard component mounts
  ↓
GET /api/dashboard/metrics (with actor.role in context)
  ↓
Backend queries based on role:
  - supplier: submissions WHERE submitted_by = actor.id
  - admin: COUNT(*) from users, submissions; SELECT from audit_logs
  - manager: aggregated stats from submissions
  - operator: pg-boss queue status, system logs
  ↓
Return metrics object (role-specific shape)
  ↓
Frontend renders role-specific layout
```

---

## 5. File Changes Summary

### New Files
```
apps/api/src/modules/dashboard/
  ├── dashboard-service.ts
  ├── index.ts
  └── routes.ts

apps/web/src/features/landing/
  └── landing-page.tsx

apps/web/src/features/auth/
  └── register-page.tsx

apps/web/src/features/welcome/
  └── welcome-page.tsx

apps/web/src/features/welcome/
  └── metrics-cards/ (optional: reusable metric card components)
```

### Modified Files
```
apps/api/src/modules/auth/
  ├── auth-service.ts (add register() function)
  └── routes.ts (add POST /api/auth/register)

apps/api/src/app.ts or src/server.ts
  └── Register dashboard routes

apps/web/src/App.tsx
  └── Add /landing, /register, /welcome routes; update RequireSession logic

apps/web/src/components/layout/sidebar.tsx
  └── Add Dashboard menu item at top

@c26/contracts/src/auth.ts
  └── Add registerSchema, dashboard metric types
```

---

## 6. Security Considerations

1. **Registration Rate Limiting:** 5 registrations per 15 min per IP (anti-spam)
2. **Password Hashing:** Use existing Argon2id implementation (PLAN/04 §4.1)
3. **Username Uniqueness:** Case-insensitive, soft-delete aware (existing constraint)
4. **Session Management:** Reuse existing session creation logic (httpOnly, Secure, SameSite=Strict)
5. **Dashboard Data Scoping:**
   - Supplier: sees only own submissions
   - Manager: sees only passed_qc submissions (existing scope)
   - Admin & operator: see appropriate aggregate data (no raw user data exposed)
6. **Public Landing Page:** No authenticated data exposed; static content only

---

## 7. Validation Plan

### Backend
1. Test `POST /api/auth/register`:
   - Valid registration → user created, session attached, can login
   - Duplicate username (case-insensitive) → DUPLICATE_USERNAME error
   - Weak password → WEAK_PASSWORD error
   - Rate limit → 403 after 5 attempts in 15 min
2. Test `GET /api/dashboard/metrics`:
   - Each role gets correct metric shape
   - Supplier sees only own data
   - Manager sees only passed_qc
   - Admin sees system-wide data

### Frontend
1. Landing page:
   - Unauthenticated users see full landing at `/`
   - "Login" button → `/login`
   - "Daftar" button → `/register`
2. Registration page:
   - Form validation works
   - Username availability check works
   - Password strength indicator shows
   - Submission succeeds, redirect to `/welcome`
3. Welcome dashboard:
   - Each role sees appropriate widgets
   - Metrics load correctly
   - Responsive on mobile/tablet/desktop
4. Routing:
   - `/` (unauthenticated) → landing page
   - `/` (authenticated) → `/welcome` redirect
   - `/login` (authenticated) → `/welcome` redirect
   - `/register` (authenticated) → `/welcome` redirect
   - `/welcome` (unauthenticated) → `/login` redirect

### Integration
1. Full user journey: register → admin activates → login → see welcome dashboard
2. Role change: login → see initial metrics → admin changes role → logout/login → see new metrics
3. Permission gating: authenticated user cannot access supplier features until admin assigns `supplier` role

---

## 8. Open Questions / Out of Scope

- **Email verification:** Not required (registration is immediate)
- **Two-factor for registration:** Not required (MFA only for admin/operator roles post-login)
- **Account recovery:** Out of scope (use existing password reset flow)
- **Profile completion:** Not required (can be done post-activation by user or admin)
- **Region selection at registration:** Not required (admin assigns regions during activation)
- **Manager region restriction:** Noted in PLAN/04 §3 as "Belum diputuskan" — keeping current state (no restriction)

---

## 9. Migration & Rollout

1. **No data migration needed** — uses existing schema
2. **Feature flag:** Can wrap new routes behind feature flag during development
3. **Phased rollout:** 
   - Phase 1-3 (backend): ready for internal testing
   - Phase 4-7 (frontend + routing): ready for UAT
   - Full rollout: once all validation passes

---

## 10. Implementation Order

1. Backend auth service + register endpoint (Phase 1)
2. Dashboard service + metrics endpoint (Phase 2)
3. Frontend landing page (Phase 3)
4. Frontend registration page (Phase 4)
5. Frontend welcome dashboard (Phase 5)
6. Frontend routing updates (Phase 6)
7. Validation & testing (Phase 7)

