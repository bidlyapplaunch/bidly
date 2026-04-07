# Bidly Codebase Audit — Issue Tracker

**Date:** 2026-04-03
**Total Issues:** ~230+ across 6 areas
**Reviewed by:** Claude Code (automated deep review)

---

## Legend

- `[ ]` = Not started
- `[~]` = In progress
- `[x]` = Fixed
- `[—]` = Won't fix / Not applicable

---

## P0: CRITICAL — Fix Before Next Deploy

### Exposed Secrets

- [x] **SEC-001** — `.env` file committed with MongoDB credentials, Shopify API keys, email passwords, JWT secret in plaintext (`auction-backend/.env`) — **RESOLVED:** .env files were already gitignored and not in version control. No credentials in git history.
- [x] **SEC-002** — Shopify Client IDs exposed in `shopify.app.bidly.toml:3`, `shopify.app.truenordic.toml:6`, `shopify(false).app.toml:4` — **RESOLVED:** TOML client_ids are public (visible in Partner dashboard). Stale shopify(false).app.toml removed.
- [x] **SEC-003** — Hardcoded API keys in `auction-admin/src/components/OAuthSetup.jsx:41-45` — **FIXED:** Now reads from `VITE_APP_HANDLE_MAP` env var
- [x] **SEC-004** — Hardcoded Client ID mapping in `auction-backend/controllers/oauthController.js:24-28` — **FIXED:** Now reads from `APP_HANDLE_MAP` env var
- [x] **SEC-005** — Hardcoded admin dashboard URL in `auction-backend/controllers/oauthController.js:141` — **FIXED:** Now reads from `ADMIN_DASHBOARD_URL` env var

### Authentication & Authorization

- [x] **AUTH-001** — Socket.IO admin bypass (`server.js:870-876`) — **FIXED:** JWT validated in connection middleware, join-admin checks server-verified role
- [x] **AUTH-002** — JWT uses fallback secret `'fallback-secret'` if env var missing (`middleware/auth.js:48`). — **FIXED:** Throws on startup if `JWT_SECRET` missing
- [x] **AUTH-003** — No auth on Socket.IO client connections — **FIXED:** Connection middleware validates JWT from handshake, customer widget sends token
- [x] **AUTH-004** — Client-side customer ID generated with `Date.now()` — **FIXED:** Customer widget now calls saveCustomer API, uses server-generated ID + JWT token
- [x] **AUTH-005** — Remix app makes client-side `fetch()` without Shopify session tokens — **FIXED:** All 5 components now use authenticatedFetch via App Bridge
- [—] **AUTH-006** — Customer auth token stored in plain `sessionStorage` vulnerable to XSS (`auction-customer/src/services/customerAuth.js:61,142`) — Deferred to P1 per user decision
- [—] **AUTH-007** — Admin dashboard stores JWT in `localStorage` without expiration/rotation (`auction-admin/src/services/auth.js:34-35`) — Deferred to P1 per user decision
- [x] **AUTH-008** — Plaintext demo credentials hardcoded in Login component (`auction-admin/src/components/Login.jsx:15-16`) — **FIXED:** Cleared defaults, removed demo hint box

### Bid System

- [x] **BID-001** — Race condition on bids (`controllers/auctionController.js:808-873`) — **FIXED:** Replaced with atomic `findOneAndUpdate` using `$expr` validation
- [x] **BID-002** — No rate limiting on bid placement (`routes/auctionRoutes.js:115`) — **FIXED:** 15 bids/min per IP on bid and buy-now endpoints
- [x] **BID-003** — No idempotency key on bid submission — **FIXED:** Client generates UUID, server checks for duplicates before atomic update
- [x] **BID-004** — Fake email generation in buyNow — **FIXED:** Now throws error if email missing, no more `@example.com` fakes

### Data Exposure

- [x] **DATA-001** — IDOR on customer lookup — **FIXED:** GET endpoints (by-email, :id, :id/stats) now require customer JWT, verify owner matches
- [x] **DATA-002** — Shop domain validation — **FIXED:** Customer JWT includes shopDomain, verified against request's shopDomain in middleware

### CORS & CSP

- [x] **CORS-001** — Express CORS allows ALL origins (`server.js:213`). — **FIXED:** Now uses `ALLOWED_ORIGINS` env var whitelist
- [x] **CORS-002** — Socket.IO CORS allows ALL origins (`server.js:120`). — **FIXED:** Now uses same `ALLOWED_ORIGINS` whitelist
- [x] **CSP-001** — CSP includes `'unsafe-inline'` AND `'unsafe-eval'` in script-src (`server.js:224-225`). — **FIXED:** Removed both from scriptSrc

### Database Config

- [x] **DB-001** — Prisma datasource hardcoded to `file:dev.sqlite` (`prisma/schema.prisma:12-14`) — **FIXED:** Now uses `env("DATABASE_URL")`
- [x] **DB-002** — MongoDB connection race condition (`app/mongodb.server.js:3-11`) — **FIXED:** Removed boolean flag, uses `readyState` directly with connecting-state handling

---

## P1: HIGH — Fix This Week

### XSS Vulnerabilities

- [x] **XSS-001** — Theme extension `innerHTML` with unsanitized API data — **FIXED:** Added `escapeHtml()` helper to all JS/Liquid files, wrapped all dynamic data in innerHTML
- [x] **XSS-002** — Rich text editor has no DOMPurify — **FIXED:** Added DOMPurify sanitization on onChange handler
- [x] **XSS-003** — Open redirect from localStorage — **FIXED:** Added `isSafeRedirectUrl()` validation, only allows same-origin and Shopify domains
- [x] **XSS-004** — Bidder names not HTML-sanitized — **FIXED:** Added `escapeHtml()` to bidder names in placeBid and buyNow
- [—] **XSS-005** — API key extracted from URL and stored on `window` object (`auction-admin/src/appBridgeGlobal.js:24-48`) — **Won't fix:** This is standard Shopify App Bridge behavior, the API key is a public client ID

### Input Validation

- [x] **VAL-001** — No validation that `buyNowPrice > startingBid` — **FIXED:** Added cross-field validation in middleware
- [x] **VAL-002** — No validation that `reservePrice < buyNowPrice` — **FIXED:** Added cross-field validation in middleware
- [x] **VAL-003** — `minBidIncrement` can be set to 0 or negative — **FIXED:** Already had explicit validation (parseFloat, >= 1)
- [x] **VAL-004** — Popcorn settings not validated on create — **FIXED:** Added validation in createAuction (1-120 trigger, 1-300 extend)
- [x] **VAL-005** — No bounds on pagination `limit` — **FIXED:** Clamped to 1-100 in all query handlers
- [x] **VAL-006** — `status` update accepts any string — **FIXED:** Added enum validation in updateAuction switch
- [x] **VAL-007** — No validation on `startingBid` in admin form — **FIXED:** Added Number.isFinite, precision, buyNow > starting, future date checks
- [x] **VAL-008** — No date-in-future validation — **FIXED:** Added to both middleware and admin form
- [x] **VAL-009** — Bid amount not checked for negative/NaN/Infinity — **FIXED:** Added Number.isFinite check in BidForm
- [x] **VAL-010** — Email validation uses simplistic regex — **FIXED:** Updated to require 2+ char TLD, anchored pattern
- [x] **VAL-011** — Shop domain not validated in webhooks — **FIXED:** Added regex validation in both redact and data_request webhooks
- [x] **VAL-012** — `BigInt()` can throw without try-catch — **FIXED:** Wrapped in try-catch, returns 400 on invalid ID
- [x] **VAL-013** — No validation on GraphQL `limit` — **FIXED:** Clamped to 1-250
- [x] **VAL-014** — Missing email/phone validation in theme extension — **FIXED:** Stricter email regex + phone sanitization

### Webhook & GDPR Compliance

- [x] **GDPR-001** — Customer redact returns 200 on failure — **FIXED:** Now throws 500, Shopify will retry
- [x] **GDPR-002** — Webhook logs full PII — **FIXED:** Removed customer data from logs, only log shop domain
- [x] **GDPR-003** — Billing sync errors swallowed — **FIXED:** Now throws 500, Shopify will retry

### Missing Security Features

- [—] **SEC-006** — No CSRF protection on any state-changing endpoints — **Won't fix:** API already protected by Shopify session tokens (admin) and customer JWTs (widget), making CSRF tokens redundant
- [x] **SEC-007** — No HTTPS enforcement — **FIXED:** Added redirect middleware for production
- [x] **SEC-008** — SSRF risk on internal fetch — **FIXED:** Added URL protocol validation on API_BASE_URL
- [x] **SEC-009** — No CSP on customer widget — **FIXED:** Added Content-Security-Policy meta tag
- [x] **SEC-010** — 10mb global body limit — **FIXED:** Reduced to 1mb default

### Environment Config

- [x] **ENV-001** — `SHOPIFY_API_SECRET` defaults to empty string (`app/shopify.server.js:12`) — **FIXED:** Throws on startup if missing
- [x] **ENV-002** — Backend URL fallback to joke domain in Remix routes — **FIXED:** All 4 route files now throw if `AUCTION_BACKEND_URL` missing
- [x] **ENV-003** — Hardcoded default shop domain `ezza-auction.myshopify.com` in customer widget — **FIXED:** Now falls back to `window.BidlyMarketplaceConfig.shop` / `window.Shopify.shop`, warns if empty
- [x] **ENV-004** — Hardcoded production backend URL fallback — **FIXED:** Replaced with empty string fallback, uses BidlyBackendConfig

---

## P2: MEDIUM — Fix Next Sprint

### Performance

- [ ] **PERF-001** — Each auction card runs its own `setInterval` for countdown. 100 auctions = 100 timers. Use single shared timer. (`auction-customer/src/components/CountdownTimer.jsx:9-40`, `auction_featured.liquid:407`, `auction_list.liquid:390`)
- [ ] **PERF-002** — N+1 query: `decorateAuction()` maps over bidHistory per auction in list (`controllers/auctionController.js:57-73`). Use MongoDB aggregation.
- [ ] **PERF-003** — No pagination in customer widget or admin dashboard auction lists
- [ ] **PERF-004** — 10-second silent refresh polls API even when Socket.IO connected (`auction-customer/src/App.jsx:290-293`)
- [ ] **PERF-005** — No `AbortController` on any fetch calls — unmount during flight causes memory warnings (all React components)
- [ ] **PERF-006** — No debouncing on product search — every keystroke fires API call (`auction-admin/src/components/AuctionForm.jsx:192-249`)
- [ ] **PERF-007** — No image lazy loading on auction cards (`auction-customer/src/components/AuctionCard.jsx:72-113`)
- [ ] **PERF-008** — Missing compound index on `{ status: 1, completedAt: 1 }` for ended auction queries
- [ ] **PERF-009** — No API response caching — rapid re-renders cause duplicate calls (`auction-customer/src/services/api.js`)
- [ ] **PERF-010** — No request timeout on axios instance in customer widget (`auction-customer/src/services/api.js:17`)
- [ ] **PERF-011** — `rows` array recreated on every render without `useMemo` in admin table (`auction-admin/src/components/AuctionTable.jsx:175-237`)
- [ ] **PERF-012** — `resolvedShopDomain` created fresh each render, causing `useCallback` to recreate (`auction-customer/src/App.jsx:82-84,133`)

### Memory Leaks

- [ ] **MEM-001** — In-memory chat rooms (`Map`) never expire (`server.js:991`). Add TTL cleanup.
- [ ] **MEM-002** — Socket event listeners not properly cleaned up in admin dashboard (`auction-admin/src/components/Dashboard.jsx:47-86`)
- [ ] **MEM-003** — Socket event listeners not properly cleaned up in customer widget (`auction-customer/src/App.jsx:285-301`)
- [ ] **MEM-004** — `MutationObserver` stored but never disconnected (`auction-app-embed.js:643`)
- [ ] **MEM-005** — `languagechange` listener accumulates on mount/unmount cycles (`auction-admin/src/App.jsx:141-149`)
- [ ] **MEM-006** — Singleton socket disconnect in one component disconnects all widgets (`auction-customer/src/App.jsx:298`)

### React Issues

- [ ] **REACT-001** — No Error Boundaries in any React app — component crash = blank screen
- [ ] **REACT-002** — Missing `Badge` import in Analytics causes runtime crash (`app/components/Analytics.jsx:97`)
- [ ] **REACT-003** — Using array `index` as fallback key in lists (`app/components/AuctionTable.jsx:97`, `Analytics.jsx:82`)
- [ ] **REACT-004** — Race condition in product search: no `AbortController`, stale results possible (`auction-admin/src/components/AuctionForm.jsx:192-249`)
- [ ] **REACT-005** — `onTimeUp` callback in dependency array recreated every render (`auction-customer/src/components/CountdownTimer.jsx:40`)
- [ ] **REACT-006** — `fetchAuctionDetails` not in useEffect dependency array (`app/components/AuctionDetails.jsx:19-23`)
- [ ] **REACT-007** — Race condition in onboarding status check (`auction-admin/src/App.jsx:197-262`)
- [ ] **REACT-008** — 401 error handler race condition with `isHandlingAuthError` flag (`auction-admin/src/services/api.js:222-232`)
- [ ] **REACT-009** — `resolvedShopDomain` used inside effect but not in dependency array (`auction-customer/src/App.jsx:302`)
- [ ] **REACT-010** — Race condition: bid can be submitted after auction ends during form processing (`auction-customer/src/App.jsx:389-430`)

### Code Cleanup

- [ ] **CLEAN-001** — Hundreds of `console.log` debug statements with emojis in production across ALL codebases
- [ ] **CLEAN-002** — Sensitive PII logged in webhooks (`webhooks.customers.data_request.jsx:12,127`)
- [ ] **CLEAN-003** — Dead service files that throw on import (`app/services/auth.js`, `app/services/api.js`, `app/services/socket.js`). Delete them.
- [ ] **CLEAN-004** — Commented-out auth middleware with no explanation (`analyticsRoutes.js:14-15`)
- [ ] **CLEAN-005** — 130 lines commented-out multi-currency code (`auction-app-embed.js:101-235`)
- [x] **CLEAN-006** — Stale config file `shopify(false).app.toml` with credentials. Delete it. — **FIXED:** File removed from git and added to .gitignore
- [ ] **CLEAN-007** — Inconsistent API response shapes across backend — some return `{ success, data }`, others `{ data }`, others raw arrays
- [ ] **CLEAN-008** — Duplicate email generation logic (`controllers/auctionController.js:1149` and `1172-1173`)
- [ ] **CLEAN-009** — Inconsistent error handling patterns — mix of `AppError`, `Error`, `next(error)`
- [ ] **CLEAN-010** — Magic numbers without named constants throughout (`server.js:967`, `models/Auction.js:195,201`)

### Dependency & Build Issues

- [ ] **DEP-001** — Dockerfile uses Node 18, `package.json` requires `>=20.10` — version mismatch
- [ ] **DEP-002** — React Router v6 in admin/customer vs v7 in root — incompatible APIs
- [ ] **DEP-003** — Vite v6 in root vs v7 in admin/customer
- [ ] **DEP-004** — `date-fns` v2 in admin/customer vs v3 in root — major version mismatch
- [ ] **DEP-005** — Polaris version inconsistency (12.12.0 root vs 12.27.0 admin/customer)
- [ ] **DEP-006** — No `lint`, `format`, or `typecheck` scripts in backend or sub-packages
- [ ] **DEP-007** — `npm remove @shopify/cli` in Dockerfile is fragile — fails if not installed

### Accessibility

- [ ] **A11Y-001** — Missing `htmlFor`/`id` associations on form labels (`auction-customer/src/components/CustomerAuth.jsx:138-162`)
- [ ] **A11Y-002** — Missing ARIA labels on close buttons, modals, interactive elements (multiple files)
- [ ] **A11Y-003** — Custom modals lack `role="dialog"` and `aria-modal="true"` (CustomerAuth modal)
- [ ] **A11Y-004** — No keyboard navigation on auction cards — click handlers only, no Tab/Enter support
- [ ] **A11Y-005** — Potential WCAG color contrast violations in customer widget and theme extension CSS

### i18n

- [ ] **I18N-001** — Translation function uses regex replacement — breaks with special chars, no pluralization support (`auction-app-embed.js:581-605`, `auction-customer/src/i18n/index.js:99-102`)
- [ ] **I18N-002** — Missing translation keys return raw key names to users (`auction-customer/src/i18n/index.js:89`)
- [ ] **I18N-003** — Hardcoded English fallback strings mixed with locale files in theme JS
- [ ] **I18N-004** — Inconsistent i18n usage in admin — some errors translated, some hardcoded (`auction-admin/src/components/OAuthSetup.jsx`)

### Theme Extension Specific

- [ ] **THEME-001** — Global scope pollution: multiple `window.*` assignments without namespacing
- [ ] **THEME-002** — Event listeners never cleaned up when widget destroyed (`bidly-widget.js`)
- [ ] **THEME-003** — Unsafe `JSON.parse()` without try-catch in ~15 locations (`bidly-hybrid-login.js`, `auction-app-embed.js`, `bidly-widget.js`)
- [ ] **THEME-004** — Excessive `!important` in CSS indicates specificity problems (`auction-app-embed.css`)
- [ ] **THEME-005** — Hardcoded cache-bust version `?v=209` in asset URL (`auction-app-embed.js:559`)
- [ ] **THEME-006** — Large unminified JS bundles (~8700 lines across 5 files)
- [ ] **THEME-007** — Sequential fetch calls in loop instead of `Promise.all()` (`bidly-hybrid-login.js:322-340`)

### Miscellaneous Config

- [ ] **CFG-001** — No `.env.example` at root level or in admin/customer packages
- [ ] **CFG-002** — Inconsistent webhook URI configs across TOML files
- [ ] **CFG-003** — Vite admin config reads TOML files at build time for API keys — fragile (`auction-admin/vite.config.js:13-60`)
- [ ] **CFG-004** — Dev proxy targets hardcoded ngrok URLs that expire (`auction-customer/vite.config.js:22`)
- [ ] **CFG-005** — Both `resolutions` (yarn) and `overrides` (npm) specified for same packages (`package.json:76-85`)

---

## P3: LOW — Backlog

- [ ] **LOW-001** — No TypeScript despite it being in devDependencies
- [ ] **LOW-002** — No PropTypes on any React components
- [ ] **LOW-003** — No JSDoc on any functions
- [ ] **LOW-004** — Inconsistent naming conventions (camelCase, snake_case, PascalCase mixed in theme JS)
- [ ] **LOW-005** — Missing responsive CSS breakpoints for tablets and small phones
- [ ] **LOW-006** — No retry logic for failed API requests in admin dashboard
- [ ] **LOW-007** — Toast notifications never auto-dismiss in customer widget
- [ ] **LOW-008** — `localStorage` used to store URL data controllable by attacker (`bidly-hybrid-login.js:694-696`)
- [ ] **LOW-009** — No `loading="lazy"` on product images
- [ ] **LOW-010** — Axios versions not pinned to exact — `^` allows auto-updates

---

## Stats

| Priority | Count | Description |
|----------|-------|-------------|
| P0 Critical | 25 | Exploitable security holes, data exposure |
| P1 High | 33 | XSS, validation gaps, compliance failures |
| P2 Medium | 55 | Performance, memory leaks, React bugs, cleanup |
| P3 Low | 10 | Code quality, developer experience |
| **Total** | **123** | Deduplicated, actionable items |
