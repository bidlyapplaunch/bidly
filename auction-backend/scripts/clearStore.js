import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config();

const clearStore = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const shopDomain = 'bidly-2.myshopify.com';
    console.log(`\n🗑️ Clearing store data for: ${shopDomain}`);
    console.log('=====================================');

    // Remove the store from database
    const result = await Store.deleteOne({ shopDomain });
    
    if (result.deletedCount > 0) {
      console.log('✅ Store removed from database');
      console.log('💡 You can now re-install the app to get a fresh access token');
    } else {
      console.log('❌ Store not found in database');
    }

  } catch (error) {
    console.error('❌ Error clearing store:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

clearStore();
