import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getMongoCollections } from "../mongodb.server";

export const action = async ({ request }) => {
  try {
    // authenticate.webhook automatically verifies HMAC signature
    // If verification fails, it will throw an error
    const { shop, topic, payload } = await authenticate.webhook(request);

    
    // Extract customer ID from payload
    // Shopify sends: { customer: { id: 191167, email: "john@example.com" }, orders_to_redact: [] }
    // customer.id is a number, not a GID
    const shopifyCustomerId = payload?.customer?.id;
    
    if (!shopifyCustomerId) {
      console.warn('No customer ID found in redact payload');
      return new Response(null, { status: 400 });
    }

    // Normalize shop domain
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    // Validate shop domain format
    const shopDomainRegex = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
    if (!shopDomainRegex.test(normalizedShop)) {
      console.error('Invalid shop domain format:', normalizedShop);
      throw new Response('Invalid shop domain', { status: 400 });
    }

    // 1. Delete/Anonymize customer data from MongoDB
    let mongoCollections;
    try {
      mongoCollections = await getMongoCollections();
    } catch (mongoError) {
      console.error('MongoDB not available for customer redact:', mongoError.message);
      throw new Response('Failed to process customer redact', { status: 500 });
    }
    
    if (mongoCollections) {
      // Find customer by shopifyId and shopDomain
      // Convert to string since MongoDB stores shopifyId as String
      const customer = await mongoCollections.customers.findOne({
        shopifyId: String(shopifyCustomerId),
        shopDomain: normalizedShop
      });

      if (customer) {
        const customerObjectId = customer._id;
        const customerEmail = customer.email;

        // Anonymize customer record (keep for auction history integrity, but remove PII)
        const redactedEmail = `redacted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@deleted.local`;
        await mongoCollections.customers.updateOne(
          { _id: customerObjectId },
          {
            $set: {
              email: redactedEmail,
              firstName: null,
              lastName: null,
              displayName: `Deleted User ${Date.now()}`,
              shopifyId: null,
              isTemp: true
            },
            $unset: {
              globalCustomerId: "",
              storeEmail: "",
              phone: ""
            }
          }
        );

        // Anonymize customer data in auction bid history
        await mongoCollections.auctions.updateMany(
          {
            shopDomain: normalizedShop,
            'bidHistory.customerId': customerObjectId.toString()
          },
          {
            $set: {
              'bidHistory.$[elem].bidder': 'Deleted User',
              'bidHistory.$[elem].customerEmail': null,
              'bidHistory.$[elem].customerId': null
            }
          },
          {
            arrayFilters: [{ 'elem.customerId': customerObjectId.toString() }]
          }
        );

        // Also update by email (for temp customers)
        await mongoCollections.auctions.updateMany(
          {
            shopDomain: normalizedShop,
            'bidHistory.customerEmail': customerEmail
          },
          {
            $set: {
              'bidHistory.$[elem].bidder': 'Deleted User',
              'bidHistory.$[elem].customerEmail': null,
              'bidHistory.$[elem].customerId': null
            }
          },
          {
            arrayFilters: [{ 'elem.customerEmail': customerEmail }]
          }
        );

      }
    }

    // 2. Delete session data from Prisma
    // Prisma deleteMany doesn't use 'where', it takes the filter directly
    let shopifyCustomerBigInt;
    try {
      shopifyCustomerBigInt = BigInt(shopifyCustomerId);
    } catch {
      console.error('Invalid Shopify customer ID:', shopifyCustomerId);
      throw new Response('Invalid customer ID', { status: 400 });
    }

    await db.session.deleteMany({
      shop: normalizedShop,
      userId: shopifyCustomerBigInt
    });


    return new Response(null, { status: 200 });
  } catch (error) {
    // Re-throw Response objects (from validation/error handling above)
    if (error instanceof Response) {
      throw error;
    }
    // HMAC verification failure or other authentication errors
    if (error.message?.includes('HMAC') || error.message?.includes('verification') || error.status === 401) {
      console.error('HMAC verification failed:', error.message);
      return new Response(null, { status: 401 });
    }
    console.error('Error processing customer redact:', error);
    return new Response(null, { status: 500 });
  }
};

