# Bidly - Shopify Auction App

## Project Overview

Bidly is a multi-tenant Shopify auction platform that lets merchants run real-time auctions on their storefronts. It consists of 4 interconnected codebases in a monorepo.

## Architecture

```
bidly-app/
├── app/                    # Shopify embedded admin (Remix/React Router)
├── auction-backend/        # Express.js API server (main backend)
├── auction-admin/          # Standalone React admin dashboard
├── auction-customer/       # Customer-facing bidding widget
├── extensions/             # Shopify theme app extension (Liquid + JS + CSS)
├── prisma/                 # Prisma schema (SQLite for Shopify session storage)
├── shared/                 # Shared utilities
├── scripts/                # Build and deployment scripts
└── build/                  # Production build output
```

### Tech Stack

- **Backend:** Express.js, MongoDB (Mongoose), Socket.IO, JWT auth
- **Shopify Admin App:** Remix / React Router v7, Prisma (SQLite), Shopify Polaris
- **Admin Dashboard:** React + Vite
- **Customer Widget:** React + Vite (embedded in storefront via theme extension)
- **Theme Extension:** Liquid templates, vanilla JS, CSS
- **Deployment:** Render (Dockerfile uses Node 18, but package.json requires >=20.10 — mismatch)

### Key Patterns

- **Multi-tenancy:** All DB queries scoped by `shopDomain`
- **Store identification:** `identifyStore` middleware resolves shop from query param
- **Auth:** JWT-based for admin; Shopify session tokens for embedded app
- **Real-time:** Socket.IO for live bid updates and chat
- **Billing:** Plan enforcement via `planGuard.js` middleware
- **i18n:** 10 languages supported in both Liquid and JS
- **Soft deletes:** Auctions use `isDeleted` flag with partial unique indexes

## Commands

### Root (Shopify App)
- `npm run dev` — Start Shopify app dev server
- `npm run build` — Build Remix app (runs `scripts/buildWithSkip.js` first)
- `npm run start` — Serve production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript type checking

### Backend (`auction-backend/`)
- `npm run dev` — Start with nodemon
- `npm run start` — Start production server
- `npm run build` — Build all (admin + customer + Remix)
- `npm test` — Jest tests

### Admin Dashboard (`auction-admin/`)
- `npm run dev` — Vite dev server
- `npm run build` — Production build

### Customer Widget (`auction-customer/`)
- `npm run dev` — Vite dev server
- `npm run build` — Production build

## Deployment

**Two channels:** Shopify Partners (extensions + app config) vs hosted services (Render). They do not replace each other.

### Theme app extension and Partners app config

- Use the **Shopify CLI**, not Render: `npm run deploy` → `shopify app deploy`.
- Publishes a new **app version** (extension assets, Liquid, `shopify.app.*` settings in that release). Does **not** deploy the Node/Remix web app.
- **Two Partner apps** exist (different `client_id`s). Deploy **both** when the extension changes so every merchant listing stays in sync:
  - `npm run deploy -- --force --config shopify.app.bidly.toml`
  - `npm run deploy -- --force --config truenordic` (uses `shopify.app.truenordic.toml`)
- Theme embed cache busting: `extensions/theme-app-extension/blocks/auction-app-embed.liquid` sets `?v=` from Liquid (`now` / date filter) so asset URLs are not stuck on a static number.

### Backend, admin, customer, and other server-hosted code

- **Commit and push** to the branch Render (or CI) watches; **Render runs your build** (e.g. `auction-backend` `prestart` / `build` as configured on the service).
- Run **`npm run build`** locally first if you want to verify before push.
- API, static admin/customer builds served by the backend, and env changes all follow this path — **not** `shopify app deploy`.

| Changed area | What to run |
|--------------|-------------|
| `extensions/`, `shopify.app.*.toml` | `shopify app deploy` with each relevant `--config` |
| `auction-backend/`, hosted admin/customer, `.env` on Render | Push → Render redeploy (build on host) |

Longer setup notes (Render, Shopify OAuth, TOML, theme extension): **`docs/reference/`** (see `docs/reference/README.md`).

## Code Conventions

- ES Modules throughout (`"type": "module"`)
- Express routes in `auction-backend/routes/`, controllers in `controllers/`
- Mongoose models in `auction-backend/models/`
- Middleware in `auction-backend/middleware/`
- Frontend components follow React patterns with Shopify Polaris (admin app)
- CSS files colocated with theme extension assets

## Important Notes

- The backend `server.js` is the main entry point and handles Express, Socket.IO, static file serving, and background auction status polling
- Webhook HMAC verification uses `crypto.timingSafeEqual` (correct)
- Store `accessToken` field uses `select: false` in Mongoose schema
- Input validation via `express-validator` middleware
- `.env` files are gitignored — see `auction-backend/env.example` for required vars
