# Login to Bid Flow — Design Spec

**Date:** 2026-04-01
**Status:** Approved

## Problem

Shopify's new customer accounts (`account.store.com`) ignore the `return_to` parameter. Customers who click "Login with Shopify" to bid get stuck on the Shopify account dashboard with no automatic redirect back to the auction product page. This kills conversion.

## Solution

Replace the Shopify login redirect with a lightweight inline registration form. Customers enter name, email, and phone number directly on the product page — no redirect, no leaving the page. Shopify login is deferred to checkout (when the winner pays via the draft order invoice).

## New Bidding Flow

### Not Logged In
Widget shows two buttons:
- **"Login to Bid"** — opens an inline form: Full Name (required), Email (required), Phone Number (required)
- **"Continue as Guest"** — unchanged, view-only

### Login to Bid Form Submission
1. Validate all three fields client-side
2. POST to `/api/customers/saveCustomer` with `{ firstName, lastName, email, phone, displayName, shopDomain }`
3. Backend creates or updates Customer record in MongoDB
4. Save customer data to `localStorage` key `bidly_bidder` as `{ name, email, phone, firstName, lastName, customerId, timestamp }`
5. Set `currentCustomer` in memory, mark `isLoggedIn = true`
6. Dispatch `bidly-login-success` event — widget refreshes, bidding is enabled

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

## Files Changed

| File | Change |
|---|---|
| `auction-backend/models/Customer.js` | Add `phone` field to schema |
| `auction-backend/routes/customerRoutes.js` | Accept `phone` in `/saveCustomer` and `/sync` |
| `extensions/theme-app-extension/assets/bidly-hybrid-login.js` | New "Login to Bid" form + submit logic, `localStorage` persistence, init checks `bidly_bidder`, updated logout |
| `extensions/theme-app-extension/assets/auction-app-embed.js` | Replace "Login with Shopify" buttons with "Login to Bid", update `handleLogout` (no Shopify redirect for bidders), update `isShopifyCustomer()` to recognize bidder customers |
| `extensions/theme-app-extension/assets/auction-app-embed.css` | Styles for the new login form |

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
