import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config({ path: './.env' });

/**
 * Store Access Token Diagnostic Script
 * This script checks the status of store access tokens in the database
 */
async function diagnoseStoreTokens() {
    try {
        console.log('🔍 Starting store access token diagnosis...');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auction');
        console.log('✅ Connected to MongoDB');

        // Get all stores
        const stores = await Store.find({}).select('+accessToken');
        
        console.log(`\n📊 Found ${stores.length} stores in database:`);
        
        if (stores.length === 0) {
            console.log('❌ No stores found in database!');
            console.log('💡 You need to install the app through Shopify OAuth first.');
            return;
        }

        let validTokens = 0;
        let invalidTokens = 0;
        let missingTokens = 0;

        for (const store of stores) {
            console.log(`\n🏪 Store: ${store.storeName} (${store.shopDomain})`);
            console.log(`   - Shopify Store ID: ${store.shopifyStoreId}`);
            console.log(`   - Installed: ${store.isInstalled}`);
            console.log(`   - Installed At: ${store.installedAt}`);
            console.log(`   - Last Access: ${store.lastAccessAt}`);
            
            if (store.accessToken) {
                if (store.accessToken === 'temp-token' || store.accessToken.length < 10) {
                    console.log(`   - ❌ Invalid Access Token: "${store.accessToken}"`);
                    invalidTokens++;
                } else {
                    console.log(`   - ✅ Valid Access Token: ${store.accessToken.substring(0, 10)}...`);
                    validTokens++;
                }
            } else {
                console.log(`   - ❌ Missing Access Token`);
                missingTokens++;
            }
        }

        console.log(`\n📈 Summary:`);
        console.log(`   - Total Stores: ${stores.length}`);
        console.log(`   - Valid Tokens: ${validTokens}`);
        console.log(`   - Invalid Tokens: ${invalidTokens}`);
        console.log(`   - Missing Tokens: ${missingTokens}`);

        if (validTokens === 0) {
            console.log(`\n❌ No stores have valid access tokens!`);
            console.log(`\n🔧 Solutions:`);
            console.log(`   1. Reinstall the app through Shopify OAuth`);
            console.log(`   2. Use the custom OAuth link to get proper tokens`);
            console.log(`   3. Check OAuth callback handling`);
            
            console.log(`\n🔗 Custom OAuth Installation Link:`);
            const clientId = process.env.SHOPIFY_API_KEY;
            const redirectUri = encodeURIComponent(`${process.env.BACKEND_URL || 'https://bidly-auction-backend.onrender.com'}/auth/shopify/callback`);
            const scopes = 'read_products,write_products,read_orders,write_orders';
            
            console.log(`   https://bidly-2.myshopify.com/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`);
        } else {
            console.log(`\n✅ Found ${validTokens} stores with valid access tokens!`);
            console.log(`   Winner processing should work for these stores.`);
        }

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the diagnosis
diagnoseStoreTokens();
