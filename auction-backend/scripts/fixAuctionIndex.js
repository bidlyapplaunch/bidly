/**
 * Migration script to fix auction index for soft delete support
 * This script drops the old unique index and relies on the new partial unique index
 * 
 * Run with: node auction-backend/scripts/fixAuctionIndex.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function fixIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('auctions');

    console.log('📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    
    console.log('Current indexes:');
    indexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify(idx)}`);
    });

    // Find the old non-partial unique index on shopDomain + shopifyProductId
    const oldIndex = indexes.find(idx => 
      idx.key &&
      idx.key.shopDomain === 1 &&
      idx.key.shopifyProductId === 1 &&
      !idx.partialFilterExpression // Not a partial index
    );

    if (oldIndex) {
      console.log('\n🗑️  Found old index to drop:', oldIndex.name);
      await collection.dropIndex(oldIndex.name);
      console.log('✅ Dropped old index');
    } else {
      console.log('\n✅ No old compound index found (may have been already dropped)');
    }

    // First, ensure all documents have isDeleted field set to false if missing
    console.log('\n📝 Ensuring all documents have isDeleted field...');
    const updateResult = await collection.updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false } }
    );
    if (updateResult.modifiedCount > 0) {
      console.log(`✅ Updated ${updateResult.modifiedCount} documents to have isDeleted: false`);
    } else {
      console.log('✅ All documents already have isDeleted field');
    }

    // Drop the old unique index on shopifyProductId alone (index #2)
    console.log('\n🗑️  Checking for old unique index on shopifyProductId...');
    const oldUniqueIndex = indexes.find(idx => 
      idx.name === 'shopifyProductId_1' && idx.unique === true
    );
    
    if (oldUniqueIndex) {
      console.log('🗑️  Found old unique index on shopifyProductId, dropping...');
      await collection.dropIndex('shopifyProductId_1');
      console.log('✅ Dropped old unique index on shopifyProductId');
      // Refresh indexes after dropping
      indexes.splice(indexes.indexOf(oldUniqueIndex), 1);
    }

    // Check if the partial unique index already exists with correct specification
    // Refresh indexes list to get latest state
    const currentIndexes = await collection.indexes();
    console.log('\n📝 Checking for existing partial unique index...');
    const existingPartialIndex = currentIndexes.find(idx => 
      idx.key &&
      idx.key.shopDomain === 1 &&
      idx.key.shopifyProductId === 1 &&
      idx.unique === true &&
      idx.partialFilterExpression &&
      idx.partialFilterExpression.isDeleted === false
    );

    if (existingPartialIndex) {
      console.log(`✅ Partial unique index already exists: ${existingPartialIndex.name}`);
      console.log('   This index already has the correct specification for soft delete support.');
    } else {
      // Create the new partial unique index
      console.log('\n📝 Creating new partial unique index...');
      try {
        await collection.createIndex(
          { shopDomain: 1, shopifyProductId: 1 },
          {
            unique: true,
            partialFilterExpression: { isDeleted: false },
            name: 'shopDomain_1_shopifyProductId_1_partial'
          }
        );
        console.log('✅ Created partial unique index');
      } catch (createError) {
        if (createError.code === 85 || createError.codeName === 'IndexOptionsConflict') {
          // Index already exists with same keys but different name/options
          // Check if it's the one we want (with partial filter)
          const currentIndexesForConflict = await collection.indexes();
          const conflictingIndex = currentIndexesForConflict.find(idx => 
            idx.key &&
            idx.key.shopDomain === 1 &&
            idx.key.shopifyProductId === 1
          );
          
          if (conflictingIndex && conflictingIndex.partialFilterExpression && 
              conflictingIndex.partialFilterExpression.isDeleted === false) {
            console.log(`✅ Index already exists with correct specification: ${conflictingIndex.name}`);
            console.log('   No action needed - the existing index supports soft delete relisting.');
          } else {
            console.log(`⚠️  Found conflicting index: ${conflictingIndex?.name || 'unknown'}`);
            console.log('   Dropping and recreating with correct specification...');
            if (conflictingIndex) {
              try {
                await collection.dropIndex(conflictingIndex.name);
              } catch (e) {
                // Ignore if doesn't exist
              }
            }
            await collection.createIndex(
              { shopDomain: 1, shopifyProductId: 1 },
              {
                unique: true,
                partialFilterExpression: { isDeleted: false },
                name: 'shopDomain_1_shopifyProductId_1_partial'
              }
            );
            console.log('✅ Recreated partial unique index');
          }
        } else {
          throw createError;
        }
      }
    }

    console.log('\n📋 Updated indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify(idx)}`);
    });

    console.log('\n✅ Index migration completed successfully!');
    console.log('\n💡 You can now create auctions with products that were soft-deleted.');
    
  } catch (error) {
    console.error('❌ Error fixing index:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixIndex()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

