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
    // Normalize shop domain (remove protocol, trailing slashes)
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    // 1. Delete all shop data from MongoDB
    let mongoCollections;
    try {
      mongoCollections = await getMongoCollections();
    } catch (mongoError) {
      console.warn('⚠️ MongoDB not available for shop redact:', mongoError.message);
    }
    
    if (mongoCollections) {
      // Delete store record
      const storeResult = await mongoCollections.stores.deleteOne({
        shopDomain: normalizedShop
      });
      console.log(`✅ Deleted store record: ${storeResult.deletedCount} document(s)`);

      // Anonymize all customer data for this shop
      // Note: MongoDB doesn't support functions in $set, so we need to process each document
      const customers = await mongoCollections.customers.find({ shopDomain: normalizedShop }).toArray();
      for (const customer of customers) {
        const redactedEmail = `redacted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@deleted.local`;
        await mongoCollections.customers.updateOne(
          { _id: customer._id },
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
      }
      const customerResult = { modifiedCount: customers.length };
      console.log(`✅ Anonymized ${customerResult.modifiedCount || customers.length} customer record(s)`);

      // Anonymize all auction bid history for this shop
      const auctionResult = await mongoCollections.auctions.updateMany(
        { shopDomain: normalizedShop },
        {
          $set: {
            'bidHistory.$[].bidder': 'Deleted User',
            'bidHistory.$[].customerEmail': null,
            'bidHistory.$[].customerId': null
          }
        }
      );
      console.log(`✅ Anonymized bid history in ${auctionResult.modifiedCount} auction(s)`);

      // Delete all auctions for this shop (or anonymize if you want to keep auction structure)
      // Option 1: Delete auctions completely
      const deleteAuctionsResult = await mongoCollections.auctions.deleteMany({
        shopDomain: normalizedShop
      });
      console.log(`✅ Deleted ${deleteAuctionsResult.deletedCount} auction(s)`);

      // Option 2: If you want to keep auction structure but remove shop data:
      // await mongoCollections.auctions.updateMany(
      //   { shopDomain: normalizedShop },
      //   {
      //     $set: {
      //       shopDomain: `deleted_${Date.now()}`,
      //       productData: null
      //     }
      //   }
      // );
    }

    // 2. Delete all session data from Prisma for this shop
    // Prisma deleteMany doesn't use 'where', it takes the filter directly
    const sessionResult = await db.session.deleteMany({
      shop: normalizedShop
    });
    console.log(`✅ Deleted ${sessionResult.count} session(s) from Prisma`);

    console.log(`✅ Completed shop data redaction for ${normalizedShop}`);

    return new Response(null, { status: 200 });
  } catch (error) {
    // HMAC verification failure or other authentication errors
    if (error.message?.includes('HMAC') || error.message?.includes('verification') || error.status === 401) {
      console.error('❌ HMAC verification failed:', error.message);
      return new Response(null, { status: 401 });
    }
    console.error('❌ Error processing shop redact:', error);
    return new Response(null, { status: 500 });
  }
};

