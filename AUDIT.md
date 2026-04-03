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

- [ ] **SEC-001** — `.env` file committed with MongoDB credentials, Shopify API keys, email passwords, JWT secret in plaintext (`auction-backend/.env`)
  - Rotate ALL credentials immediately
  - Add `.env*` to `.gitignore`
  - Scrub from git history with `git filter-repo` or BFG
- [ ] **SEC-002** — Shopify Client IDs exposed in `shopify.app.bidly.toml:3`, `shopify.app.truenordic.toml:6`, `shopify(false).app.toml:4`
- [ ] **SEC-003** — Hardcoded API keys in `auction-admin/src/components/OAuthSetup.jsx:41-45`
- [ ] **SEC-004** — Hardcoded Client ID mapping in `auction-backend/controllers/oauthController.js:24-28`
- [ ] **SEC-005** — Hardcoded admin dashboard URL in `auction-backend/controllers/oauthController.js:141`

### Authentication & Authorization

- [ ] **AUTH-001** — Socket.IO admin bypass: anyone can emit `join-admin` with `'admin'` string and join admin room (`server.js:870-876`). Requires server-side JWT validation.
- [ ] **AUTH-002** — JWT uses fallback secret `'fallback-secret'` if env var missing (`middleware/auth.js:48`). Remove fallback, fail on startup.
- [ ] **AUTH-003** — No auth on Socket.IO client connections (`auction-customer/src/services/socket.js:22-27`)
- [ ] **AUTH-004** — Client-side customer ID generated with `Date.now()` — predictable and spoofable (`auction-customer/src/components/CustomerAuth.jsx:62`). Generate server-side only.
- [ ] **AUTH-005** — Remix app makes client-side `fetch()` without Shopify session tokens, bypassing embedded app auth (`app/components/Dashboard.jsx:64`, `AuctionTable.jsx:28`, `AuctionForm.jsx:52`, `AuctionDetails.jsx:31`, `Analytics.jsx:28`)
- [ ] **AUTH-006** — Customer auth token stored in plain `sessionStorage` vulnerable to XSS (`auction-customer/src/services/customerAuth.js:61,142`)
- [ ] **AUTH-007** — Admin dashboard stores JWT in `localStorage` without expiration/rotation (`auction-admin/src/services/auth.js:34-35`)
- [ ] **AUTH-008** — Plaintext demo credentials hardcoded in Login component (`auction-admin/src/components/Login.jsx:15-16`)

### Bid System

- [ ] **BID-001** — Race condition: read-then-write on bids allows two users to win same price (`controllers/auctionController.js:808-873`). Use atomic `findOneAndUpdate` with field comparison.
- [ ] **BID-002** — No rate limiting on bid placement (`routes/auctionRoutes.js:115`). Add per-IP rate limiter.
- [ ] **BID-003** — No idempotency key on bid submission — double-click = duplicate bid (`auction-customer/src/App.jsx:394`)
- [ ] **BID-004** — Fake email generation (`@example.com`) when email missing allows auction wins without valid contact (`controllers/auctionController.js:1149,1172-1173`)

### Data Exposure

- [ ] **DATA-001** — IDOR on customer lookup: anyone can query any customer's PII by ObjectId or Shopify ID (`controllers/auctionController.js:75-102`). Add owner verification.
- [ ] **DATA-002** — Shop domain from URL param not validated — attacker can access other shops' data (`auction-customer/src/App.jsx:74`, `services/api.js:32`)

### CORS & CSP

- [ ] **CORS-001** — Express CORS allows ALL origins (`server.js:213`). Whitelist specific domains.
- [ ] **CORS-002** — Socket.IO CORS allows ALL origins (`server.js:120`). Whitelist specific domains.
- [ ] **CSP-001** — CSP includes `'unsafe-inline'` AND `'unsafe-eval'` in script-src, defeating XSS protection (`server.js:224-225`). Remove both, use nonces.

### Database Config

- [ ] **DB-001** — Prisma datasource hardcoded to `file:dev.sqlite` instead of `DATABASE_URL` env var (`prisma/schema.prisma:12-14`)
- [ ] **DB-002** — MongoDB connection race condition: concurrent webhook calls can create duplicate connections (`app/mongodb.server.js:3-11`)

---

## P1: HIGH — Fix This Week

### XSS Vulnerabilities

- [ ] **XSS-001** — Theme extension `innerHTML` with unsanitized API data (product titles, prices, bidder names) across `auction-app-embed.js:878-2827`, `bidly-widget.js:289-353`, `auction_featured.liquid:353`, `auction_list.liquid:311`. Use `textContent` or DOMPurify.
- [ ] **XSS-002** — Rich text editor in admin has no DOMPurify on pasted content (`auction-admin/src/components/RichTextEditor.jsx:26-36`)
- [ ] **XSS-003** — Open redirect: `window.location.href` set from localStorage without URL validation (`bidly-hybrid-login.js:719,1068`)
- [ ] **XSS-004** — Bidder names only length-validated, no HTML/script sanitization (`controllers/auctionController.js:760,796-798`)
- [ ] **XSS-005** — API key extracted from URL and stored on `window` object (`auction-admin/src/appBridgeGlobal.js:24-48`)

### Input Validation

- [ ] **VAL-001** — No validation that `buyNowPrice > startingBid` on auction creation
- [ ] **VAL-002** — No validation that `reservePrice < buyNowPrice`
- [ ] **VAL-003** — `minBidIncrement` can be set to 0 or negative during update (`controllers/auctionController.js:441-495`)
- [ ] **VAL-004** — Popcorn settings validated on update but NOT on create (`controllers/auctionController.js:195-222` vs `531-545`)
- [ ] **VAL-005** — No bounds on pagination `limit` param — `limit=999999` causes memory exhaustion (`controllers/auctionController.js:343,359`)
- [ ] **VAL-006** — `status` field update accepts any string, bypassing enum (`controllers/auctionController.js:489`)
- [ ] **VAL-007** — No validation on `startingBid` (positive, NaN, precision) in admin form (`auction-admin/src/components/AuctionForm.jsx:268-290`)
- [ ] **VAL-008** — No date-in-future validation on auction creation
- [ ] **VAL-009** — Bid amount not checked for negative/NaN/Infinity in customer widget (`auction-customer/src/components/BidForm.jsx:27,37`)
- [ ] **VAL-010** — Email validation uses overly simplistic regex (`auction-customer/src/components/CustomerAuth.jsx:41`)
- [ ] **VAL-011** — Shop domain not validated as Shopify domain format in webhooks (`app/routes/webhooks.customers.data_request.jsx:32`)
- [ ] **VAL-012** — `BigInt(shopifyCustomerId)` can throw without try-catch (`app/routes/webhooks.customers.data_request.jsx:111`)
- [ ] **VAL-013** — No validation on GraphQL `limit` param — can request 999999 products (`app/routes/api.shopify.products.jsx:37`)
- [ ] **VAL-014** — Missing email/phone validation in theme extension registration (`bidly-hybrid-login.js:723-797`)

### Webhook & GDPR Compliance

- [ ] **GDPR-001** — Customer redact webhook returns 200 OK on MongoDB failure — Shopify won't retry, data won't be anonymized (`webhooks.customers.redact.jsx:32-33`)
- [ ] **GDPR-002** — Customer data request webhook logs full PII to console (`webhooks.customers.data_request.jsx:127`)
- [ ] **GDPR-003** — Billing sync errors swallowed, webhook returns 200 (`webhooks.app_subscriptions.update.jsx:21-27`)

### Missing Security Features

- [ ] **SEC-006** — No CSRF protection on any state-changing endpoints
- [ ] **SEC-007** — No HTTPS enforcement in production
- [ ] **SEC-008** — Unsafe fetch to internal API without URL validation — SSRF risk (`controllers/auctionController.js:131,717`)
- [ ] **SEC-009** — No Content Security Policy on customer widget (`auction-customer/index.html`)
- [ ] **SEC-010** — Request body limit set to 10mb globally, no per-endpoint limits (`server.js:329`)

### Environment Config

- [ ] **ENV-001** — `SHOPIFY_API_SECRET` defaults to empty string (`app/shopify.server.js:12`). Should throw on startup.
- [ ] **ENV-002** — Backend URL fallback to `https://bidly-backend.hiiiiiiiiiii.com` in Remix routes. Should fail if env var missing.
- [ ] **ENV-003** — Hardcoded default shop domain `ezza-auction.myshopify.com` in customer widget (`auction-customer/src/services/api.js:6`, `socket.js:5`)
- [ ] **ENV-004** — Hardcoded production backend URL fallback in customer widget (`auction-customer/src/services/api.js:14`, `socket.js:13`, `themeService.js:12`)

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
- [ ] **CLEAN-006** — Stale config file `shopify(false).app.toml` with credentials. Delete it.
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
