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
