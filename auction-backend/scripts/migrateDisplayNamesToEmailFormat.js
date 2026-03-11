#!/usr/bin/env node

/**
 * Migration: Update existing customers' display names from the old format
 * (Adjective+Animal, e.g. "CosmicPanda") to the new format (email prefix + word, e.g. "johnbCosmic").
 *
 * Only updates display names that match our old auto-generated pattern.
 * Skips names that look user-set (e.g. "John Smith", custom nicknames).
 *
 * Usage:
 *   node scripts/migrateDisplayNamesToEmailFormat.js
 *   node scripts/migrateDisplayNamesToEmailFormat.js --dry-run   # Preview only, no writes
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import generateRandomName, { isLegacyGeneratedName } from '../utils/generateRandomName.js';

dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  try {
    console.log('🔄 Migrating customer display names to email-based format\n');
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
        if (!customer.displayName?.trim()) {
          // Empty display name – regenerate
          const newName = generateRandomName(customer.email);
          if (!DRY_RUN) {
            customer.displayName = newName;
            await customer.save();
          }
          console.log(`  ✓ ${customer.email}: (empty) → ${newName}`);
          migrated++;
          continue;
        }

        if (!isLegacyGeneratedName(customer.displayName)) {
          skipped++;
          continue; // Don't log every skip to keep output manageable
        }

        const oldName = customer.displayName;
        const newName = generateRandomName(customer.email);
        if (!DRY_RUN) {
          customer.displayName = newName;
          await customer.save();
        }
        console.log(`  ✓ ${customer.email}: ${oldName} → ${newName}`);
        migrated++;
      } catch (err) {
        console.error(`  ✗ ${customer.email}: ${err.message}`);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  - Migrated: ${migrated}`);
    console.log(`  - Skipped (not old format): ${skipped}`);
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
