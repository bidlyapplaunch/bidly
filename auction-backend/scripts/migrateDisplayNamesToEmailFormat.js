#!/usr/bin/env node

/**
 * Migration: Set every customer's displayName to the canonical value from their email:
 * first 5 alphanumeric chars of the local part (see generateRandomName.js).
 *
 * Usage:
 *   node scripts/migrateDisplayNamesToEmailFormat.js
 *   node scripts/migrateDisplayNamesToEmailFormat.js --dry-run   # Preview only, no writes
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import generateRandomName from '../utils/generateRandomName.js';

dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  try {
    console.log('🔄 Syncing customer display names to email-prefix format\n');
    if (DRY_RUN) {
      console.log('⚠️  DRY RUN – no changes will be written\n');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');

    const customers = await Customer.find({});
    console.log(`📋 Found ${customers.length} total customers\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const customer of customers) {
      try {
        const newName = generateRandomName(customer.email);
        const current = (customer.displayName || '').trim();

        if (current === newName) {
          skipped++;
          continue;
        }

        if (!DRY_RUN) {
          customer.displayName = newName;
          await customer.save();
        }
        console.log(`  ✓ ${customer.email}: "${current || '(empty)'}" → ${newName}`);
        migrated++;
      } catch (err) {
        console.error(`  ✗ ${customer.email}: ${err.message}`);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  - Updated: ${migrated}`);
    console.log(`  - Already correct: ${skipped}`);
    console.log(`  - Errors: ${errors}`);
    if (DRY_RUN && migrated > 0) {
      console.log('\n  Run without --dry-run to apply changes.');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

migrate();
