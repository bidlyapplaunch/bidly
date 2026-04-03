# Bidly - Code Review Issues Log

> Generated: 2026-03-16
> Status: UNFIXED — all issues below are pending resolution

---

## CRITICAL (Must Fix Before Production)

### C1. Insecure Secret Fallbacks
- **File:** `auction-backend/middleware/auth.js:48`
- **Issue:** `process.env.JWT_SECRET || 'fallback-secret'` — if env var is unset, tokens signed with `'fallback-secret'` are accepted by anyone
- **File:** `auction-backend/controllers/authController.js:205`
- **Issue:** `process.env.ADMIN_PASSWORD || 'admin123'` — trivially guessable default admin password
- **Fix:** Remove all fallback values. Server should refuse to start if required secrets are missing.
- **Status:** UNFIXED

### C2. OAuth HMAC Timing Attack
- **File:** `auction-backend/services/shopifyOAuthService.js:238`
- **Issue:** `calculatedHmac === hmac` uses non-constant-time comparison, vulnerable to timing attacks. The webhook handler in `server.js` correctly uses `crypto.timingSafeEqual`, but the OAuth flow does not.
- **Also:** Lines 234-235 log HMAC values to console (information leak)
- **Fix:** Use `crypto.timingSafeEqual` with Buffer conversion. Remove HMAC logging.
- **Status:** UNFIXED

### C3. Debug Routes Exposed Without Authentication
- **File:** `auction-backend/routes/debugRoutes.js`
- **Issue:** `/api/debug/*` routes have zero authentication:
  - `GET /api/debug/oauth-test/:shopDomain` — reveals partial access tokens, scopes
  - `DELETE /api/debug/clear-store/:shopDomain` — deletes any store record
  - `GET /api/debug/stores` — lists all stores with token metadata
  - `POST /api/debug/set-plan/:shopDomain` — changes any store's billing plan
  - `GET /api/debug/routes` (defined directly in `server.js:622`, not in debugRoutes.js)
- **No `NODE_ENV` guard exists**
- **Fix:** Remove entirely, or gate behind `NODE_ENV === 'development'` + admin auth.
- **Status:** UNFIXED

### C4. Most API Routes Have No Authentication
- **Files:**
  - `auction-backend/routes/auctionRoutes.js` — all auction CRUD (create/update/delete)
  - `auction-backend/routes/customerRoutes.js` — all customer data
  - `auction-backend/routes/billingRoutes.js` — plan subscribe/cancel/override
  - `auction-backend/routes/chatRoutes.js` — chat monitor/delete
  - `auction-backend/routes/shopifyRoutes.js` — product search
  - `auction-backend/routes/marketplaceCustomization.js` — store customization
  - `auction-backend/routes/onboarding.js` — onboarding completion
  - `auction-backend/routes/metafields.js` — product metafield modification
  - `auction-backend/routes/analyticsRoutes.js:14` — `requireAuth` is imported but commented out
- **Issue:** Routes only use `identifyStore` which derives shop from query param (`?shop=`), headers (`X-Shopify-Shop-Domain`), or request body — all client-supplied. Anyone who knows a shop domain can perform admin operations.
- **Fix:** Add `requireAuth` middleware to all admin-facing routes.
- **Status:** UNFIXED

### C5. WebSocket Has No Authentication
- **File:** `auction-backend/server.js` (lines ~837-980)
- **Issues:**
  - CORS `origin: true` accepts all connections
  - `join-admin` event trusts client-reported `userRole` — any client can claim admin
  - `authenticate` event stores unverified `userData`
  - Chat messages accept any `username` without verification
- **Fix:** Require JWT verification on socket connection. Verify admin claims server-side.
- **Status:** UNFIXED

### C6. Bid Race Conditions (Non-Atomic Updates)
- **File:** `auction-backend/controllers/auctionController.js` (placeBid function)
- **Issue:** Bid placement reads auction, validates bid amount, then saves — not atomic. Two concurrent bids can both succeed at the same price, or a lower bid can overwrite a higher one.
- **Fix:** Use `findOneAndUpdate` with `$push` for bid history and `$set` for currentBid with a filter condition `currentBid: { $lt: newAmount }`.
- **Status:** UNFIXED

---

## IMPORTANT (Should Fix)

### I1. CORS Accepts All Origins
- **File:** `auction-backend/server.js:207`
- **Issue:** `origin: (origin, callback) => callback(null, true)` with `credentials: true` — any website can make authenticated API calls
- **Fix:** Configure an allowlist of origins (Shopify admin, app domains, storefront domains).
- **Status:** UNFIXED

### I2. Create-Admin Endpoint Is Publicly Accessible
- **File:** `auction-backend/routes/authRoutes.js:18`
- **Issue:** `POST /create-admin` is before `requireAuth` middleware. If admin is deleted, anyone can recreate it.
- **Fix:** Remove endpoint or gate behind a one-time setup token / env flag.
- **Status:** UNFIXED

### I3. `verifyToken` Used But Never Defined
- **File:** `auction-backend/middleware/auth.js:122`
- **Issue:** `optionalAuth` middleware calls `verifyToken(token)` which is never defined or imported. Always throws `ReferenceError`, silently caught. Any code relying on `optionalAuth` for user context never works.
- **Fix:** Import or define `verifyToken`, or inline the `jwt.verify()` call.
- **Status:** UNFIXED

### I4. XSS Risk in Theme Extension Widget
- **File:** `extensions/theme-app-extension/assets/auction-app-embed.js`
- **Issue:** 30+ `innerHTML` usages inject API data (auction titles, bidder names, product descriptions) without sanitization. `escapeHtml` exists and is used for chat messages but not for other data.
- **Fix:** Use `textContent` for plain text, or apply `escapeHtml` to all user-controllable data before `innerHTML`.
- **Status:** UNFIXED

### I5. No Rate Limiting
- **Files:** Entire `auction-backend/`
- **Issue:** No `express-rate-limit` or equivalent on any endpoint. Login, registration, and bid endpoints are vulnerable to brute-force.
- **Fix:** Add `express-rate-limit` at minimum on `/api/auth/login`, `/api/auth/register`, `/api/auctions/:id/bid`, `/api/customers/temp-login`.
- **Status:** UNFIXED

### I6. Chat Messages Stored In-Memory Only
- **File:** `auction-backend/server.js:984`
- **Issue:** `const chatRooms = new Map()` — all chat messages are lost on server restart/deploy.
- **Fix:** Persist to MongoDB or add a disclaimer that chat is ephemeral.
- **Status:** UNFIXED

### I7. server.js Is a 1,153-Line Monolith
- **File:** `auction-backend/server.js`
- **Issue:** Mixes Express setup, route registration, WebSocket handling, chat logic, auction status polling, email notifications, winner processing, and static file serving.
- **Fix:** Extract WebSocket, chat, auction status checker, and static serving into separate modules.
- **Status:** UNFIXED

### I8. Auction Status Polling Every 5 Seconds
- **File:** `auction-backend/server.js:1132`
- **Issue:** `setInterval(checkAuctionStatusChanges, 5000)` queries ALL pending/active auctions every 5 seconds. Doesn't scale with many auctions.
- **Fix:** Use a job queue (Bull, Agenda) or increase interval with batch processing.
- **Status:** UNFIXED

### I9. `runValidators: false` on Auction Updates
- **Files:** `auction-backend/controllers/auctionController.js:643` and `:1477`
- **Issue:** Schema validators explicitly disabled during updates in two locations — Mongoose validation rules can be bypassed.
- **Fix:** Set `runValidators: true` or ensure custom validation covers all cases.
- **Status:** UNFIXED

### I10. Self-Calling HTTP for Metafield Updates
- **File:** `auction-backend/controllers/auctionController.js:131-147`
- **Issue:** Server makes `fetch` calls to itself (`localhost:5000/api/metafields/...`) instead of calling the metafields service directly. Adds unnecessary network overhead.
- **Fix:** Import and call the metafields service function directly.
- **Status:** UNFIXED

---

## SUGGESTIONS (Nice to Have)

### S1. Junk Files Tracked in Git
- **Files:** `{` (empty), `response.json())` (empty) — both in repo root
- **Fix:** `git rm` both files
- **Status:** UNFIXED

### S2. Excessive Documentation in Root
- 26 markdown files in root — many are stale development notes
- **Fix:** Consolidate into `docs/` folder or remove stale ones
- **Status:** UNFIXED

### S3. Accidental Config Artifacts
- `shopify(false).app.toml` — generated by mistake
- `shopify.app.second.toml-truenordic` — development artifact
- **Fix:** Remove from repo
- **Status:** UNFIXED

### S4. `.DS_Store` Committed
- **File:** `app/.DS_Store`
- **Fix:** `git rm` and add `.DS_Store` to `.gitignore`
- **Status:** UNFIXED

### S5. Excessive Console Logging
- Nearly every function logs with emoji prefixes. Can leak sensitive info (HMAC values, token lengths).
- **Fix:** Use structured logging library (winston/pino) with log levels
- **Status:** UNFIXED

### S6. Duplicate `computeAuctionStatus` Implementations
- Defined in 3 places: `server.js`, `auctionController.js`, `auctionRoutes.js`
- **Fix:** Extract to a single shared utility
- **Status:** UNFIXED

### S7. Vite Dev Proxy Placeholder Domain
- **File:** `auction-admin/vite.config.js:75`
- **Issue:** `target: 'https://bidly-backend.hiiiiiiiiiii.com/'` — placeholder domain
- **Fix:** Use localhost or env variable
- **Status:** UNFIXED

### S8. Dockerfile / Node Version Mismatch
- `Dockerfile` uses `node:18-alpine`, `package.json` requires `>=20.10`
- **Fix:** Update Dockerfile to `node:20-alpine` or later
- **Status:** UNFIXED

### S9. Global State Pollution
- **File:** `auction-backend/server.js:991`
- **Issue:** `global.broadcastAuctionStatusUpdate` pollutes global namespace
- **Fix:** Use dependency injection or module exports
- **Status:** UNFIXED

### S10. `.cursor/` Not in `.gitignore`
- IDE config directory exists in repo root
- **Fix:** Add `.cursor/` to `.gitignore`
- **Status:** UNFIXED
