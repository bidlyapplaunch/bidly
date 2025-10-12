import User from '../models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const createTestAccounts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions');
    console.log('Connected to MongoDB');

    // Create admin account
    const adminExists = await User.findOne({ email: 'admin@bidly.com' });
    if (!adminExists) {
      const admin = new User({
        name: 'Admin User',
        email: 'admin@bidly.com',
        password: 'password123',
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Admin account created: admin@bidly.com / password123');
    } else {
      console.log('ℹ️ Admin account already exists');
    }

    // Create customer account
    const customerExists = await User.findOne({ email: 'customer@bidly.com' });
    if (!customerExists) {
      const customer = new User({
        name: 'Customer User',
        email: 'customer@bidly.com',
        password: 'password123',
        role: 'customer'
      });
      await customer.save();
      console.log('✅ Customer account created: customer@bidly.com / password123');
    } else {
      console.log('ℹ️ Customer account already exists');
    }

    // Create test customer account
    const testCustomerExists = await User.findOne({ email: 'test@bidly.com' });
    if (!testCustomerExists) {
      const testCustomer = new User({
        name: 'Test User',
        email: 'test@bidly.com',
        password: 'password123',
        role: 'customer'
      });
      await testCustomer.save();
      console.log('✅ Test customer account created: test@bidly.com / password123');
    } else {
      console.log('ℹ️ Test customer account already exists');
    }

    console.log('\n🎉 Test accounts setup complete!');
    console.log('\n📋 Test Account Credentials:');
    console.log('Admin: admin@bidly.com / password123');
    console.log('Customer: customer@bidly.com / password123');
    console.log('Test User: test@bidly.com / password123');

  } catch (error) {
    console.error('❌ Error creating test accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
createTestAccounts();
