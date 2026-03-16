# Blast Email & Customer List — Mail Service Feature

**Date:** 2026-03-16
**Status:** Approved

## Overview

Add customer email listing and blast email functionality to the Mail Service section of the admin dashboard. Merchants can view all customers linked to their store, compose blast/push emails (from scratch or templates), and send them to all or selected customers — either all at once or via configurable trickle delivery. The existing broken "simple" editor is replaced with a rich text editor (`react-quill-new`, the maintained fork) across all email editing surfaces.

### Plan Gating

- **Customer List (Tab 2):** Available on all plans (read-only view of own customers)
- **Blast Emails (Tab 3):** Pro+ plans only (same gate as email template customization)

---

## 1. Data Model

### New: `BlastEmail` (MongoDB)

```js
{
  shopDomain: String,          // indexed, multi-tenant scope
  subject: String,
  body: String,                // HTML from rich editor
  status: String,              // enum: 'draft', 'sending', 'completed', 'failed'
  deliveryMode: String,        // enum: 'all', 'trickle'
  trickleConfig: {
    batchSize: Number,         // default: 50
    intervalMinutes: Number    // default: 5
  },
  recipients: [{
    customerId: ObjectId,      // ref: Customer
    email: String,
    displayName: String,
    status: String,            // enum: 'pending', 'sent', 'failed'
    sentAt: Date,
    error: String
  }],
  stats: {
    total: Number,
    sent: Number,
    failed: Number
  },
  createdAt: Date,
  updatedAt: Date,
  sentAt: Date                 // when sending started
}
```

Indexes: `{ shopDomain: 1, status: 1 }`, `{ shopDomain: 1, createdAt: -1 }`

### Existing Models — No Changes

`Customer` model already has `email`, `displayName`, `shopDomain`, `totalBids`, `auctionsWon`. Queried as-is.

---

## 2. Backend API Endpoints

All endpoints use existing middleware: `identifyStore`, `requireAuth`, `attachPlanContext`.

### Customer List

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/email-settings/customers` | Paginated, searchable customer list for the store |

**Query params:** `?page=1&limit=25&search=john`
**Search fields:** email, displayName (primary), firstName, lastName (may be null for many customers)
**Response:**
```json
{
  "customers": [{ "_id", "email", "displayName", "firstName", "lastName", "totalBids", "auctionsWon" }],
  "total": 142,
  "page": 1,
  "limit": 25
}
```

### Blast Emails

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/email-settings/blasts` | List all blasts (drafts + sent, paginated) |
| GET | `/email-settings/blasts/:id` | Get single blast with recipient details |
| POST | `/email-settings/blasts` | Create blast (draft or send immediately) |
| PUT | `/email-settings/blasts/:id` | Update a draft |
| POST | `/email-settings/blasts/:id/send` | Send a saved draft |
| DELETE | `/email-settings/blasts/:id` | Delete a draft only |

### Create/Update Payload

```json
{
  "subject": "Spring Sale!",
  "body": "<p>Rich HTML content...</p>",
  "deliveryMode": "trickle",
  "trickleConfig": { "batchSize": 50, "intervalMinutes": 5 },
  "recipientIds": ["id1", "id2"],
  "selectAll": true,
  "saveAsDraft": false
}
```

- `selectAll` and `recipientIds` are mutually exclusive — API rejects payloads containing both
- `selectAll: true` — backend resolves all customers for the `shopDomain` at send time
- `recipientIds` — only those customers receive the email (must be non-empty when `selectAll` is false)
- `saveAsDraft: true` — saves without sending

### Validation Rules

| Field | Constraint |
|-------|-----------|
| `subject` | Required, max 200 characters (matches existing `SUBJECT_LIMIT`) |
| `body` | Required, max 500KB |
| `batchSize` | 1–500 (default: 50) |
| `intervalMinutes` | 1–60 (default: 5) |
| `recipientIds` | Non-empty array when `selectAll` is false |
| Max recipients per blast | 10,000 |
| Max concurrent sending blasts per store | 1 |

### Auth Requirements

- `GET /email-settings/customers` — requires `requireAuth` (contains PII)
- All blast endpoints — require `requireAuth` + Pro+ plan gate

---

## 3. Blast Email Service

**New file:** `auction-backend/services/blastEmailService.js`

### Core Functions

- `sendBlast(blastId)` — loads blast, resolves recipients, dispatches based on `deliveryMode`
- `sendTrickleBatch(blastId, batchIndex)` — sends one batch, updates DB stats, schedules next via `setTimeout`
- `getBlastProgress(blastId)` — returns current stats for frontend polling

### Sending Logic

- **All at once:** Iterates all recipients, sends via existing `emailService.sendEmail()` transport (respects store's custom SMTP)
- **Trickle:** Chunks recipients into `batchSize` groups, sends first immediately, `setTimeout` for subsequent batches at `intervalMinutes` intervals

### Token Resolution

Per-recipient personalization:
- `{{customer_name}}` — recipient's `firstName lastName` or `displayName`
- `{{display_name}}` — recipient's `displayName`
- `{{store_name}}` — from Store model

Auction-specific tokens (`{{auction_title}}`, `{{current_bid}}`, etc.) are **not available** in blast emails. The token panel for blasts only shows applicable tokens.

### Crash Recovery

On server startup, query for `BlastEmail` documents with `status: 'sending'` and resume them from the last unsent batch. This is handled in `blastEmailService.resumeInterruptedBlasts()`, called from `server.js` after DB connection is established.

### Error Handling

- Individual email failures marked per-recipient as `failed` with error message, do not stop the batch
- If >50% of a batch fails, pause and mark blast as `failed`
- Merchant can see which recipients failed in the history detail view

### Unsubscribe

- Auto-append an unsubscribe footer to all blast emails with `{{unsubscribe_url}}` token
- Add `unsubscribed: Boolean (default: false)` field to the `Customer` model
- Backend filters out unsubscribed customers when resolving recipients
- Unsubscribe endpoint: `GET /email-settings/unsubscribe?email=...&shop=...&token=...` (token-based, no auth required)
- Unsubscribed customers still appear in the customer list but are marked with a badge and excluded from sends

### HTML Sanitization

- Blast email `body` HTML is sanitized with `DOMPurify` when rendered in the admin dashboard history/detail views to prevent stored XSS
- The raw HTML is preserved as-is for email delivery (email clients handle their own sanitization)

---

## 4. Admin Dashboard UI

### Tab Structure

`MailServicePage` becomes a tabbed layout:

**Tab 1: Email Templates** — existing functionality with editor upgrade
**Tab 2: Customer List** — new
**Tab 3: Blast Emails** — new

### Rich Text Editor (all tabs)

- Replace simple/HTML toggle with **Rich Editor / HTML** toggle across all email editing
- Rich editor: `react-quill-new` (maintained fork of react-quill, compatible with React 18+) with toolbar (bold, italic, underline, lists, links, images, colors, alignment)
- HTML mode: raw textarea for advanced users (existing behavior)
- Wrapped in reusable `RichTextEditor` component

### Tab 1: Email Templates

- Everything currently in `MailServiceSettings` stays
- Editor toggle changes from simple/HTML to Rich/HTML
- Token chips sidebar remains

### Tab 2: Customer List

- Table with columns: checkbox, email, display name, total bids, auctions won
- Search bar (filters by email/name)
- Pagination (25 per page)
- "Select all" checkbox in header
- Selected count badge: "3 of 142 selected"
- "Compose Blast Email" button — navigates to Tab 3 with selected customers pre-loaded

### Tab 3: Blast Emails

**Compose section:**
- Subject line input
- Rich text editor (default), HTML toggle available
- Token chips (blast-applicable tokens only)
- Recipient summary: "Sending to 142 customers" or "Sending to 3 selected customers" with "Edit recipients" link to Tab 2
- Delivery mode toggle: **Send All** | **Trickle**
- When Trickle: batch size (number input) + interval in minutes (number input)
- Actions: "Save as Draft" | "Send Now"
- "Send Now" triggers confirmation modal: "Send this email to X recipients?"

**History section (below compose):**
- Table: subject, date, recipient count, status, sent/total progress
- Click row to expand full details + per-recipient status
- Draft rows: "Edit" and "Delete" actions
- Sending rows: progress bar (sent/total), polls every 10s for updates

---

## 5. File Changes

### New Files

| File | Purpose |
|------|---------|
| `auction-backend/models/BlastEmail.js` | Mongoose model |
| `auction-backend/services/blastEmailService.js` | Trickle/blast sending logic |
| `auction-backend/routes/blastEmailRoutes.js` | API endpoints (mounted as sub-router under `/api/email-settings/blasts` in `server.js`) |
| `auction-admin/src/components/CustomerListTab.jsx` | Customer list table with selection |
| `auction-admin/src/components/BlastEmailTab.jsx` | Compose + history UI |
| `auction-admin/src/components/RichTextEditor.jsx` | React-Quill wrapper component |
| `auction-admin/src/services/blastEmailApi.js` | API client for blast endpoints |

### Modified Files

| File | Change |
|------|--------|
| `auction-admin/src/pages/MailServicePage.jsx` | Add tab navigation for 3 tabs |
| `auction-admin/src/components/MailServiceSettings.jsx` | Replace simple/HTML toggle with Rich/HTML, integrate `RichTextEditor` |
| `auction-admin/src/services/emailSettingsApi.js` | Add `getCustomers()` endpoint call |
| `auction-backend/routes/emailSettings.js` | Add `/customers` endpoint |
| `auction-backend/server.js` | Mount blast email routes |
| `auction-admin/package.json` | Add `react-quill-new` and `dompurify` dependencies |
| `auction-backend/models/Customer.js` | Add `unsubscribed: Boolean` field |

### Unchanged

- `GlobalCustomer` model, `EmailSettings` model, `emailService.js` — all reused as-is
