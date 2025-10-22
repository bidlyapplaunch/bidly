import mongoose from 'mongoose';
import Store from '../models/Store.js';

// Connect to database
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// Clear store record
const clearStoreRecord = async () => {
  try {
    console.log('\n🗑️ Clearing store record for bidly-2.myshopify.com...\n');
    
    // Find and delete the store record
    const result = await Store.deleteOne({ shopDomain: 'bidly-2.myshopify.com' });
    
    if (result.deletedCount > 0) {
      console.log('✅ Successfully deleted store record');
      console.log('   - Store: bidly-2.myshopify.com');
      console.log('   - Records deleted: 1');
    } else {
      console.log('ℹ️ No store record found to delete');
    }
    
    // List remaining stores
    const remainingStores = await Store.find({});
    console.log(`\n📊 Remaining stores: ${remainingStores.length}`);
    
    for (const store of remainingStores) {
      console.log(`   - ${store.shopDomain} (${store.storeName})`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing store record:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await clearStoreRecord();
  process.exit(0);
};

main();
