# Render Build Command Fix

## Current Issue
Render's build command is: `npm install && npm run build`
This runs from `auction-backend/` directory, but Remix is at the repo root.

## Solution

Update Render's **Build Command** to:

```bash
cd .. && npm install && npm run build && cd auction-backend && npm install
```

This will:
1. Go to repo root (`cd ..`)
2. Install root dependencies (including Remix build tools)
3. Build Remix (`npm run build` creates `build/server` and `build/client`)
4. Return to `auction-backend/`
5. Install backend dependencies

## Alternative (Simpler)

If you want to use the existing `auction-backend/package.json` build script:

**Build Command:**
```bash
npm run build
```

This uses the script in `auction-backend/package.json` which does `cd .. && npm install && npm run build`.

**But you still need to install backend deps, so:**

**Build Command:**
```bash
npm install && npm run build
```

This will:
1. Install backend deps (triggers `postinstall` which runs `buildRemixIfMissing.js`)
2. Run `npm run build` which builds Remix from root

## Recommended Fix

**Build Command:**
```bash
cd .. && npm install && npm run build && cd auction-backend && npm install
```

This ensures:
- Root dependencies are installed (needed for Remix build)
- Remix is built (creates `build/` directory)
- Backend dependencies are installed
- Everything happens in the correct order

