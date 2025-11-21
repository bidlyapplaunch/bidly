import Store from "../models/Store.js";
import { AppError } from "./errorHandler.js";

/**
 * NORMALIZE ANY POSSIBLE SHOP DOMAIN
 */
const normalizeShopDomain = (raw) => {
  if (!raw) return null;

  let shop = raw
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // If the shop appears WITHOUT ".myshopify.com", add it.
  if (!shop.includes(".")) {
    shop = `${shop}.myshopify.com`;
  }

  // If it’s a custom domain (e.g., true-nordic.com)
  const looksCustomDomain =
    /^[a-z0-9-]+\.[a-z]{2,}$/.test(shop) && !shop.includes("myshopify.com");

  if (looksCustomDomain) return shop;

  // If it's a Shopify domain WITHOUT the suffix
  if (!shop.endsWith(".myshopify.com") && !looksCustomDomain) {
    shop = `${shop}.myshopify.com`;
  }

  return shop;
};

/**
 * EXTRACT SHOP DOMAIN FROM THE REQUEST
 * (Most flexible, future-proof logic)
 */
const extractShopDomain = (req) => {
  const candidates = [
    req.query.shop,
    req.query.store,
    req.query.shopDomain,
    req.headers["x-shopify-shop-domain"],
    req.headers["x-shopify-shop"],
    req.headers["x-forwarded-host"],
    req.body?.shop,
    req.body?.shopDomain,
    req.store?.shopDomain,
  ].filter(Boolean);

  // Take the first valid domain that normalizes properly
  for (const raw of candidates) {
    const normalized = normalizeShopDomain(raw);
    if (normalized) return normalized;
  }

  return null;
};

/**
 * MAIN MIDDLEWARE: Identify the store and attach req.shopDomain + req.store
 */
export const identifyStore = async (req, res, next) => {
  try {
    const shopDomain = extractShopDomain(req);

    if (!shopDomain) {
      console.log("❌ No valid shop domain extracted");
      console.log("🔍 Incoming request details:", {
        query: req.query,
        headers: req.headers,
        body: req.body,
        url: req.url,
      });
      return next(new AppError("Shop domain is required (middleware)", 400));
    }

    console.log("🏪 Identifying store:", shopDomain);

    const store = await Store.findByDomain(shopDomain);

    if (!store) {
      return next(
        new AppError(
          `Store ${shopDomain} not found. Please install the app first.`,
          404
        )
      );
    }

    if (!store.isInstalled) {
      return next(
        new AppError(
          `Store ${shopDomain} is not installed. Please reinstall the app.`,
          403
        )
      );
    }

    req.store = store;
    req.shopDomain = shopDomain;

    await store.updateLastAccess();

    console.log("✅ Store identified:", store.storeName, `(${shopDomain})`);
    next();
  } catch (err) {
    console.error("❌ identifyStore error:", err);
    next(new AppError("Failed to identify store", 500));
  }
};

export default identifyStore;
