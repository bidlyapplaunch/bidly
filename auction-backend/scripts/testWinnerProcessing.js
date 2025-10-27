import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Auction from './models/Auction.js';
import Store from './models/Store.js';
import winnerProcessingService from './services/winnerProcessingService.js';

// Load environment variables
dotenv.config({ path: './.env' });

/**
 * Test script for winner processing workflow
 */
async function testWinnerProcessing() {
    try {
        console.log('🧪 Starting winner processing test...');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auction');
        console.log('✅ Connected to MongoDB');

        // Find a test auction that has ended with bids
        const testAuction = await Auction.findOne({
            status: 'ended',
            bidHistory: { $exists: true, $not: { $size: 0 } },
            winnerProcessed: { $ne: true }
        });

        if (!testAuction) {
            console.log('⚠️ No suitable test auction found. Creating a test scenario...');
            
            // Create a test auction
            const testStore = await Store.findOne({ accessToken: { $exists: true } });
            if (!testStore) {
                throw new Error('No store with access token found for testing');
            }

            const testAuctionData = {
                shopDomain: testStore.shopDomain,
                shopifyProductId: '123456789',
                productData: {
                    id: '123456789',
                    title: 'Test Product for Winner Processing',
                    handle: 'test-product-winner-processing',
                    description: 'This is a test product for winner processing',
                    price: 100,
                    image: {
                        src: 'https://via.placeholder.com/300x300',
                        alt: 'Test Product'
                    }
                },
                startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
                startingBid: 50,
                currentBid: 150,
                status: 'ended',
                bidHistory: [
                    {
                        bidder: 'Test Bidder 1',
                        customerEmail: 'test1@example.com',
                        amount: 75,
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
                    },
                    {
                        bidder: 'Test Winner',
                        customerEmail: 'winner@example.com',
                        amount: 150,
                        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
                        customerId: 'test-customer-id'
                    }
                ]
            };

            const newTestAuction = new Auction(testAuctionData);
            await newTestAuction.save();
            console.log('✅ Created test auction:', newTestAuction._id);

            // Test the winner processing
            await winnerProcessingService.processAuctionWinner(newTestAuction._id, testStore.shopDomain);
            console.log('✅ Winner processing completed for test auction');

        } else {
            console.log('✅ Found test auction:', testAuction._id);
            console.log('📊 Auction details:', {
                productTitle: testAuction.productData?.title,
                currentBid: testAuction.currentBid,
                bidCount: testAuction.bidHistory.length,
                status: testAuction.status
            });

            // Test the winner processing
            await winnerProcessingService.processAuctionWinner(testAuction._id, testAuction.shopDomain);
            console.log('✅ Winner processing completed for existing auction');
        }

        // Verify the results
        const updatedAuction = await Auction.findById(testAuction?._id || newTestAuction._id);
        console.log('📋 Updated auction data:', {
            winnerProcessed: updatedAuction.winnerProcessed,
            winner: updatedAuction.winner,
            privateProduct: updatedAuction.privateProduct
        });

        console.log('🎉 Winner processing test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the test
testWinnerProcessing();
