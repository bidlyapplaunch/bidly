import mongoose from 'mongoose';

/**
 * Connect to MongoDB for GDPR webhook operations
 * Uses the same connection string as the auction backend
 *
 * Relies on mongoose.connection.readyState to avoid race conditions
 * where concurrent calls could bypass a boolean flag before it is set.
 *   0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export async function connectMongoDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    // Already connecting — wait for that attempt to finish
    await new Promise(resolve => mongoose.connection.once('connected', resolve));
    return mongoose.connection;
  }

  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/bidly-auctions';

    if (!mongoURI) {
      console.warn('⚠️ MONGODB_URI not set, GDPR webhooks may not work correctly');
      return null;
    }

    await mongoose.connect(mongoURI);
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

