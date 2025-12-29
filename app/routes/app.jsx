import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Ensure Store exists in MongoDB (non-blocking)
  // This helps prevent errors when the app first loads after installation
  try {
    const collections = await import("../mongodb.server").then(m => m.getMongoCollections());
    if (collections && collections.stores) {
      const shopDomain = session.shop;
      const normalizedShop = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

      // Get shop info from Shopify
      const shopQuery = `#graphql
        query getShopInfo {
          shop {
            id
            name
            email
            currencyCode
            ianaTimezone
            primaryDomain {
              host
            }
          }
        }
      `;

      const shopResponse = await admin.graphql(shopQuery);
      const shopData = await shopResponse.json();
      const shop = shopData.data?.shop;

      if (shop) {
        const shopifyStoreId = parseInt(shop.id.split('/').pop());
        const existingStore = await collections.stores.findOne({ shopDomain: normalizedShop });

        const storeData = {
          shopDomain: normalizedShop,
          shopifyStoreId,
          storeName: shop.name,
          storeEmail: shop.email || '',
          currency: shop.currencyCode || 'USD',
          timezone: shop.ianaTimezone || 'UTC',
          accessToken: session.accessToken,
          scope: session.scope || '',
          isInstalled: true,
          plan: 'free',
          planName: 'Free Plan',
          installedAt: existingStore?.installedAt || new Date(),
          lastAccessAt: new Date(),
          knownDomains: shop.primaryDomain?.host 
            ? [normalizedShop, shop.primaryDomain.host]
            : [normalizedShop]
        };

        if (existingStore) {
          await collections.stores.updateOne(
            { shopDomain: normalizedShop },
            { $set: storeData }
          );
          console.log(`✅ Updated store record for ${normalizedShop}`);
        } else {
          await collections.stores.insertOne({
            ...storeData,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ Created store record for ${normalizedShop}`);
        }
      }
    }
  } catch (error) {
    // Silently fail - this is non-critical, store will be created on first API call
    console.warn("Could not ensure store in MongoDB (non-critical):", error.message);
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/additional">Additional page</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
