import { authenticate } from "../shopify.server";
import { syncStorePlanFromShopify } from "../../auction-backend/services/billingService.js";
import Store from "../../auction-backend/models/Store.js";

export const action = async ({ request }) => {
  try {
    const { shop, topic, payload } = await authenticate.webhook(request);

    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    
    // Get store using Store model
    const store = await Store.findByDomain(normalizedShop);
    
    if (!store) {
      console.warn(`Store not found for ${normalizedShop} in subscription update webhook`);
      return new Response("Store not found", { status: 404 });
    }

    // Sync plan from Shopify when subscription updates
    try {
      const result = await syncStorePlanFromShopify(store);
    } catch (syncError) {
      console.error(`Failed to sync plan for ${normalizedShop}:`, syncError.message);
      throw new Response('Failed to sync billing', { status: 500 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    // Re-throw Response objects (from error handling above)
    if (error instanceof Response) {
      throw error;
    }
    console.error("Webhook error:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
};

