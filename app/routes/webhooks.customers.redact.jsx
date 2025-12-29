import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getMongoCollections } from "../mongodb.server";

export const action = async ({ request }) => {
  try {
    // authenticate.webhook automatically verifies HMAC signature
    // If verification fails, it will throw an error
    const { shop, topic, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Extract customer ID from payload
    // Shopify sends: { customer: { id: 191167, email: "john@example.com" }, orders_to_redact: [] }
    // customer.id is a number, not a GID
    const shopifyCustomerId = payload?.customer?.id;
    
    if (!shopifyCustomerId) {
      console.warn('⚠️ No customer ID found in payload');
      return new Response(null, { status: 400 });
    }

    // Normalize shop domain
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    // 1. Delete/Anonymize customer data from MongoDB
    let mongoCollections;
    try {
      mongoCollections = await getMongoCollections();
    } catch (mongoError) {
      console.warn('⚠️ MongoDB not available for customer redact:', mongoError.message);
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

        console.log(`✅ Anonymized customer data for ${shopifyCustomerId} in shop ${shop}`);
      }
    }

    // 2. Delete session data from Prisma
    await db.session.deleteMany({
      where: {
        shop: normalizedShop,
        userId: BigInt(shopifyCustomerId)
      }
    });

    console.log(`✅ Deleted session data for customer ${shopifyCustomerId} in shop ${shop}`);

    return new Response(null, { status: 200 });
  } catch (error) {
    // HMAC verification failure or other authentication errors
    if (error.message?.includes('HMAC') || error.message?.includes('verification') || error.status === 401) {
      console.error('❌ HMAC verification failed:', error.message);
      return new Response(null, { status: 401 });
    }
    console.error('❌ Error processing customer redact:', error);
    return new Response(null, { status: 500 });
  }
};

