import mongoose from 'mongoose';
import Auction from '../models/Auction.js';
import dotenv from 'dotenv';

dotenv.config();

async function updateExistingAuctionMetafields() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auction');
    console.log('Connected to MongoDB');

    // Find all auctions
    const auctions = await Auction.find({});
    console.log(`Found ${auctions.length} auctions`);

    for (const auction of auctions) {
      console.log(`Updating metafields for auction ${auction._id} (${auction.productData?.title || 'Unknown'})`);
      
      // Update metafields via API call
      const response = await fetch(`https://bidly-auction-backend.onrender.com/api/metafields/products/${auction.shopifyProductId}/auction-metafields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'temp-token'}`
        },
        body: JSON.stringify({
          shop: auction.shopDomain,
          auctionData: {
            auctionId: auction._id,
            status: auction.status,
            currentBid: auction.currentBid || 0,
            startingBid: auction.startingBid,
            reservePrice: auction.reservePrice || 0,
            startTime: auction.startTime,
            endTime: auction.endTime,
            bidCount: auction.bidHistory?.length || 0,
            buyNowPrice: auction.buyNowPrice || 0
          }
        })
      });

      if (response.ok) {
        console.log(`✅ Updated metafields for auction ${auction._id}`);
      } else {
        const error = await response.text();
        console.log(`❌ Failed to update metafields for auction ${auction._id}:`, error);
      }
    }

    console.log('Finished updating all auction metafields');
  } catch (error) {
    console.error('Error updating auction metafields:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateExistingAuctionMetafields();
