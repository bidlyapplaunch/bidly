import mongoose from 'mongoose';
import Auction from '../models/Auction.js';
import dotenv from 'dotenv';

dotenv.config();

const checkAuctionStartTimes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const auctions = await Auction.find({}).limit(5);
    console.log(`Found ${auctions.length} auctions:`);
    
    auctions.forEach((auction, index) => {
      console.log(`\nAuction ${index + 1}:`);
      console.log(`  ID: ${auction._id}`);
      console.log(`  startTime: ${auction.startTime}`);
      console.log(`  startTime type: ${typeof auction.startTime}`);
      console.log(`  startTime instanceof Date: ${auction.startTime instanceof Date}`);
      console.log(`  endTime: ${auction.endTime}`);
      console.log(`  status: ${auction.status}`);
    });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkAuctionStartTimes();
