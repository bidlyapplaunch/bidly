import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  
  // Handle customer data request (GDPR compliance)
  // The payload contains the customer ID and shop domain
  // You should return all customer data associated with this shop
  
  // TODO: Implement data export logic
  // This should return all customer data you have stored for the requested customer
  
  return new Response();
};

