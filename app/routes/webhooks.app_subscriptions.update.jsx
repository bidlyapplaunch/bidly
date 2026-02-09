import { authenticate } from "../shopify.server";
import { syncStorePlanFromShopify } from "../../auction-backend/services/billingService.js";
import Store from "../../auction-backend/models/Store.js";

export const action = async ({ request }) => {
  try {
    const { shop, topic, payload } = await authenticate.webhook(request);
    console.log(`📨 Received ${topic} webhook for ${shop}`);

    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    
    // Get store using Store model
    const store = await Store.findByDomain(normalizedShop);
    
    if (!store) {
      console.warn(`⚠️ Store not found for ${normalizedShop} in subscription update webhook`);
      return new Response("Store not found", { status: 404 });
    }

    // Sync plan from Shopify when subscription updates
    try {
      const result = await syncStorePlanFromShopify(store);
      console.log(`✅ Successfully synced plan for ${normalizedShop}: ${result.activePlan} (changed: ${result.changed})`);
    } catch (syncError) {
      console.error(`❌ Failed to sync plan for ${normalizedShop}:`, syncError);
      // Don't fail the webhook - log and continue
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
};

