# Shopify TOML Files Explanation

This document explains which `.toml` file to use for which Shopify app.

## File Overview

### 1. `shopify.app.toml` - Default App (First App)
**Used for**: `bidly-2.myshopify.com` → `bidly-auction-backend.onrender.com`

- **Client ID**: `1f94308027df312cd5f038e7fb75cc16`
- **Backend URL**: `https://bidly-auction-backend.onrender.com`
- **Store**: `bidly-2.myshopify.com`

**When to use**: When deploying/testing the first/default app

---

### 2. `shopify.app.bidly.toml` - Alternative Config for First App
**Used for**: Same as `shopify.app.toml` (alternative configuration)

- **Client ID**: `1f94308027df312cd5f038e7fb75cc16` (updated to match first app)
- **Backend URL**: `https://bidly-auction-backend.onrender.com`
- **Store**: `bidly-2.myshopify.com`

**When to use**: Alternative config file for the first app (if needed)

---

### 3. `shopify.app.second.toml` - Second App (NEW)
**Used for**: `6sb15z-k1.myshopify.com` → `bidly-auction-backend-2.onrender.com`

- **Client ID**: `de32970476f2ecf20d98f9d9b6994c89`
- **Backend URL**: `https://bidly-auction-backend-2.onrender.com`
- **Store**: `6sb15z-k1.myshopify.com`

**When to use**: When deploying/testing the second app

---

## How to Use Different TOML Files

### For Shopify CLI Commands

When using Shopify CLI, specify which config file to use with `--config`:

```bash
# Deploy first app
shopify app deploy --config shopify.app.toml

# Deploy second app
shopify app deploy --config shopify.app.second.toml

# Or use the alternative config for first app
shopify app deploy --config shopify.app.bidly.toml
```

### Default Behavior

If you don't specify `--config`, Shopify CLI will use `shopify.app.toml` by default.

### Development

```bash
# Dev first app (default)
shopify app dev

# Dev second app
shopify app dev --config shopify.app.second.toml
```

---

## Summary

| TOML File | App | Client ID | Backend | Store |
|----------|-----|-----------|---------|-------|
| `shopify.app.toml` | First | `1f94308027df312cd5f038e7fb75cc16` | `bidly-auction-backend.onrender.com` | `bidly-2.myshopify.com` |
| `shopify.app.bidly.toml` | First (alt) | `1f94308027df312cd5f038e7fb75cc16` | `bidly-auction-backend.onrender.com` | `bidly-2.myshopify.com` |
| `shopify.app.second.toml` | Second | `de32970476f2ecf20d98f9d9b6994c89` | `bidly-auction-backend-2.onrender.com` | `6sb15z-k1.myshopify.com` |

---

## Notes

- Each `.toml` file corresponds to a different Shopify app
- The `shopify.app.toml` is the default (used when no `--config` is specified)
- When deploying extensions, use the appropriate config file for that app
- The backend URLs in the `.toml` files must match the backend routing configuration

