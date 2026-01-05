import { Outlet, useLoaderData, useRouteError } from "react-router";
import { ShopifyAppProvider } from "@shopify/shopify-app-remix/react";
import { PolarisProvider } from "@shopify/polaris";
import polarisEnTranslations from "@shopify/polaris/locales/en.json";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Ensure Store exists in MongoDB BEFORE returning
  // This is critical to prevent errors when the app first loads after installation
  const shopDomain = session.shop;
  const normalizedShop = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  
  try {
    const { getMongoCollections } = await import("../mongodb.server");
    const collections = await getMongoCollections();
    
    if (collections && collections.stores) {
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

        // Prepare store data with all required fields (storeEmail is required)
        const storeData = {
          shopDomain: normalizedShop,
          shopifyStoreId,
          storeName: shop.name || normalizedShop,
          storeEmail: shop.email || `${normalizedShop}@example.com`, // Required field, use fallback if empty
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
      } else {
        console.warn(`⚠️ Could not fetch shop info for ${normalizedShop}`);
      }
    } else {
      console.warn("⚠️ MongoDB collections not available, store will not be created");
    }
  } catch (error) {
    // Log the error but don't fail - the app should still load
    console.error("❌ Error ensuring store in MongoDB:", error);
    console.error("Error details:", error.stack);
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <ShopifyAppProvider apiKey={apiKey} isEmbeddedApp>
      <PolarisProvider i18n={polarisEnTranslations}>
        <Outlet />
      </PolarisProvider>
    </ShopifyAppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
