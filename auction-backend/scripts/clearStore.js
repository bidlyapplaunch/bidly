import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from '../models/Store.js';

dotenv.config();

const clearStore = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    const result = await Store.deleteOne({ shopDomain: 'ezza-auction.myshopify.com' });
    console.log('🗑️ Store record deleted:', result);
    
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

clearStore();
