import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  
  // Handle shop data redaction (GDPR compliance)
  // This is called when a shop uninstalls the app
  // You must delete all shop data
  
  // TODO: Implement shop data deletion logic
  // This should delete all data associated with this shop
  
  return new Response();
};

