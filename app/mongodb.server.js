import mongoose from 'mongoose';

let isConnected = false;

/**
 * Connect to MongoDB for GDPR webhook operations
 * Uses the same connection string as the auction backend
 */
export async function connectMongoDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/bidly-auctions';
    
    if (!mongoURI) {
      console.warn('⚠️ MONGODB_URI not set, GDPR webhooks may not work correctly');
      return null;
    }

    await mongoose.connect(mongoURI);
    isConnected = true;
    console.log('✅ MongoDB connected for GDPR webhooks');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return null;
  }
}

/**
 * Get MongoDB collections directly (simpler approach for GDPR operations)
 */
export async function getMongoCollections() {
  const connection = await connectMongoDB();
  if (!connection) {
    return null;
  }

  // Access the database through mongoose connection
  const db = mongoose.connection.db;
  if (!db) {
    console.error('❌ MongoDB database not available');
    return null;
  }

  return {
    customers: db.collection('customers'),
    auctions: db.collection('auctions'),
    stores: db.collection('stores')
  };
}

