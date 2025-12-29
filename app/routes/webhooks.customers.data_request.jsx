import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getMongoCollections } from "../mongodb.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    // Extract customer ID from payload
    // Shopify sends: { customer: { id: "gid://shopify/Customer/123" }, orders_requested: [] }
    const customerId = payload?.customer?.id;
    const shopifyCustomerId = customerId ? customerId.replace('gid://shopify/Customer/', '') : null;
    
    if (!shopifyCustomerId) {
      console.warn('⚠️ No customer ID found in payload');
      return new Response(null, { status: 400 });
    }

    const customerData = {
      shop,
      shopifyCustomerId,
      timestamp: new Date().toISOString(),
      data: {}
    };

    // Normalize shop domain
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    // 1. Get customer data from MongoDB
    let mongoCollections;
    try {
      mongoCollections = await getMongoCollections();
    } catch (mongoError) {
      console.warn('⚠️ MongoDB not available for data request:', mongoError.message);
    }
    
    if (mongoCollections) {
      // Find customer by shopifyId and shopDomain (primary lookup)
      let customer = await mongoCollections.customers.findOne({
        shopifyId: shopifyCustomerId,
        shopDomain: normalizedShop
      });

      // If not found by shopifyId, try to get customer email from Shopify API
      // For now, we'll search by shopifyId only as that's what the webhook provides
      if (!customer && payload?.customer?.email) {
        // Fallback: try to find by email (for edge cases)
        customer = await mongoCollections.customers.findOne({
          email: payload.customer.email.toLowerCase(),
          shopDomain: normalizedShop
        });
      }

      if (customer) {
        customerData.data.customer = {
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          displayName: customer.displayName,
          shopifyId: customer.shopifyId,
          isTemp: customer.isTemp,
          bidHistory: customer.bidHistory || [],
          totalBids: customer.totalBids || 0,
          auctionsWon: customer.auctionsWon || 0,
          totalBidAmount: customer.totalBidAmount || 0,
          createdAt: customer.createdAt,
          lastLoginAt: customer.lastLoginAt
        };

        // Find all auctions where this customer placed bids
        const customerObjectId = customer._id;
        const customerEmail = customer.email;

        const auctions = await mongoCollections.auctions.find({
          shopDomain: normalizedShop,
          $or: [
            { 'bidHistory.customerId': customerObjectId.toString() },
            { 'bidHistory.customerEmail': customerEmail }
          ]
        }).toArray();

        customerData.data.auctions = auctions.map(auction => ({
          auctionId: auction._id.toString(),
          productId: auction.shopifyProductId,
          productTitle: auction.productData?.title,
          bids: auction.bidHistory?.filter(bid => 
            bid.customerId?.toString() === customerObjectId.toString() ||
            bid.customerEmail === customerEmail
          ).map(bid => ({
            amount: bid.amount,
            timestamp: bid.timestamp,
            isWinning: bid.isWinning || false
          })) || []
        }));
      } else {
        // Customer not found in our database, but log for reference
        console.log(`ℹ️ Customer ${shopifyCustomerId} not found in database for shop ${shop}`);
      }
    }

    // 2. Get session data from Prisma (if any)
    const sessions = await db.session.findMany({
      where: {
        shop: normalizedShop,
        userId: BigInt(shopifyCustomerId)
      }
    });

    if (sessions.length > 0) {
      customerData.data.sessions = sessions.map(session => ({
        id: session.id,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        locale: session.locale,
        expires: session.expires
      }));
    }

    // Log the data export (in production, you might want to send this to Shopify or store it)
    console.log('📦 Customer data export:', JSON.stringify(customerData, null, 2));

    // Note: According to GDPR, you should provide this data to the customer
    // This webhook is just a notification - you may need to implement a separate endpoint
    // to actually deliver the data to the customer

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('❌ Error processing customer data request:', error);
    return new Response(null, { status: 500 });
  }
};

