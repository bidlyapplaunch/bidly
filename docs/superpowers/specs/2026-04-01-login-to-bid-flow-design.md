# Register to Bid Flow — Design Spec

**Date:** 2026-04-01
**Status:** Approved

## Problem

Shopify's new customer accounts (`account.store.com`) ignore the `return_to` parameter. Customers who click "Login with Shopify" to bid get stuck on the Shopify account dashboard with no automatic redirect back to the auction product page. This kills conversion.

## Solution

Replace the Shopify login redirect with a lightweight inline registration form. Customers enter name, email, and phone number directly on the product page — no redirect, no leaving the page. Shopify login is deferred to checkout (when the winner pays via the draft order invoice).

**Important distinction:** This is self-asserted identity (not Shopify authentication). Anyone can enter any email. The UI copy must say **"Register to Bid"** / **"Enter your details to bid"** — never "Login" — to avoid confusion with Shopify account login and reduce support/trust issues.

## New Bidding Flow

### Not Logged In
Widget shows two buttons:
- **"Register to Bid"** — opens an inline form: Full Name (required), Email (required), Phone Number (required)
- **"Continue as Guest"** — unchanged, view-only

### Register to Bid Form Submission
1. Validate all three fields client-side (name non-empty, email format, phone non-empty)
2. POST to `/api/customers/saveCustomer` with `{ firstName, lastName, email, phone, displayName, shopDomain }`
3. Backend validates and normalizes: email lowercase + trim, phone trim, rate-limit by IP
4. Backend creates or updates Customer record in MongoDB (matched by email + shopDomain)
5. Save customer data to `localStorage` key `bidly_bidder` as `{ name, email, phone, firstName, lastName, customerId, timestamp }`
6. Set `currentCustomer` in memory, mark `isLoggedIn = true`
7. Dispatch `bidly-login-success` event — widget refreshes, bidding is enabled

### Returning Bidders
On page load, `bidly-hybrid-login.js` init checks `localStorage` for `bidly_bidder`. If found, auto-login with stored credentials — no form needed.

### Logout
- Clears `bidly_bidder` from `localStorage`
- Clears all other bidly session keys (`bidly_guest_customer`, `bidly_last_customer_id`, `shopify_customer`, `bidly_return_to`)
- Does NOT redirect to Shopify `/account/logout` (customer never logged into Shopify)
- Widget resets to the two-button view

### Login Priority
1. Liquid-injected `window.customerData` (Shopify logged-in customer) — highest
2. `localStorage` `bidly_bidder` (returning bidder)
3. `sessionStorage` `bidly_guest_customer` (view-only guest) — lowest

If a Shopify customer IS detected via Liquid, they take priority and get the full experience without needing the form.

### Bidding
No changes to bid placement. `submitInlineBid` / `submitBid` already send `{ amount, bidder, bidderEmail, customerEmail, customerId }` — all provided by the new flow.

### Winning
No changes. Winner processing already:
1. Gets winner email from bid record
2. Calls `findOrCreateCustomer()` to create Shopify customer if needed
3. Duplicates product (private, priced at winning bid)
4. Creates draft order linked to Shopify customer
5. Sends invoice email with payment link
6. Winner clicks link → logs into Shopify at checkout → pays

### Notifications
No changes. All email notifications (bid confirmation, outbid, winner, blast emails) key off `bidderEmail` / `customerEmail` which the new flow provides.

## Data Changes

### Customer Model (`Customer.js`)
Add one field:
```javascript
phone: {
  type: String,
  trim: true,
  default: null
}
```

### Customer Routes (`customerRoutes.js`)
Accept `phone` in `/saveCustomer` and `/sync` endpoints. Save to Customer record. Return in response.

### Bid Placement (`auctionController.js`)
No changes. Phone is stored on the Customer record, not needed at bid time.

## Backend Hardening for `saveCustomer`

This endpoint becomes effectively public (called from the storefront without Shopify auth). It must be hardened:

- **Rate limiting:** Cap requests per IP (e.g. 10 registrations per minute per IP). The existing `express-rate-limit` setup can be extended or a specific limiter added to this route.
- **Email validation:** Normalize to lowercase, trim whitespace, reject obviously invalid formats server-side (not just client-side).
- **Phone validation:** Trim whitespace, reject empty strings. Light format check (digits, spaces, dashes, plus sign — no strict international format enforcement since this is global).
- **Duplicate handling:** Matched by `email + shopDomain` (existing unique index). If a record exists, update name/phone — don't create a duplicate. This handles same customer from different devices.
- **Scope by shopDomain:** Already enforced by `identifyStore` middleware on all routes. No additional work needed.

## Security & Trust Model

- **This is self-asserted identity, not authenticated.** The server must NOT grant any privilege based solely on `localStorage` or `bidly_bidder` data. All bid placement goes through the existing `placeBid` endpoint which validates against the backend. `localStorage` is a convenience cache for pre-filling — the backend Customer record is the source of truth.
- **`isShopifyCustomer()` distinction:** The implementation must clearly distinguish between a real Shopify customer (detected via Liquid `window.customerData`) and a bidly_bidder registrant. Bidly bidders must NOT be treated as Shopify customers — they get bidding access only. Any future feature that requires a real Shopify customer session (e.g. loyalty points, account-level actions) must check Liquid/Shopify session, not `bidly_bidder`.
- **localStorage is user-editable.** Acceptable for this use case since the backend validates all bids independently. If a user tampers with localStorage, the worst case is a display glitch — not a security bypass.

## Privacy & Compliance Note

Collecting email + phone is PII. Merchants using Bidly should:
- Disclose data collection in their storefront privacy policy
- Be aware of regional requirements (GDPR, etc.)
- The existing unsubscribe mechanism covers email opt-out for blast emails

This is a merchant responsibility (Bidly provides the tool, merchants configure their compliance). No code changes needed, but worth noting for documentation.

## Files Changed

| File | Change |
|---|---|
| `auction-backend/models/Customer.js` | Add `phone` field to schema |
| `auction-backend/routes/customerRoutes.js` | Accept `phone` in `/saveCustomer` and `/sync`, add rate limiter |
| `extensions/theme-app-extension/assets/bidly-hybrid-login.js` | New "Register to Bid" form + submit logic, `localStorage` persistence, init checks `bidly_bidder`, updated logout |
| `extensions/theme-app-extension/assets/auction-app-embed.js` | Replace "Login with Shopify" buttons with "Register to Bid", update `handleLogout` (no Shopify redirect for bidders), update `isShopifyCustomer()` to clearly distinguish bidder vs Shopify customer |
| `extensions/theme-app-extension/assets/auction-app-embed.css` | Styles for the new registration form |

## Files NOT Changed

- `auctionController.js` — placeBid already works
- `winnerProcessingService.js` — already works
- `emailService.js` — already works
- `shopifyService.js` — already works
- `auction-app-embed.liquid` — no structural changes
- `auction-customer/` — separate marketplace flow
- `auction-admin/` — reads Customer model, phone available automatically

## Continue as Guest

Completely unchanged. View-only, no name/email/phone required, stored in `sessionStorage`, cleared on browser close.
