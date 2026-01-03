#!/usr/bin/env node
/**
 * Diagnostic script to verify Shopify app URL configuration
 * Run this to check if your app URLs are accessible and properly configured
 */

import https from 'https';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read TOML files
function readTomlConfig(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const urlMatch = content.match(/application_url\s*=\s*["']?([^"'\n]+)["']?/);
    return urlMatch ? urlMatch[1] : null;
  } catch (error) {
    return null;
  }
}

// Test URL accessibility
function testUrl(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname || '/',
      method: 'GET',
      timeout: 10000,
      rejectUnauthorized: true
    };

    const req = https.request(options, (res) => {
      const endTime = Date.now();
      resolve({
        success: true,
        statusCode: res.statusCode,
        responseTime: endTime - startTime,
        headers: res.headers
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        code: error.code
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout',
        code: 'ETIMEDOUT'
      });
    });

    req.end();
  });
}

// Main diagnostic function
async function diagnose() {
  console.log('🔍 Shopify App URL Diagnostic Tool\n');
  console.log('=' .repeat(60));

  // Check TOML configurations
  console.log('\n📋 Checking TOML Configuration Files:');
  const bidlyToml = join(__dirname, '..', 'shopify.app.bidly.toml');
  const secondToml = join(__dirname, '..', 'shopify.app.second.toml');

  const bidlyUrl = readTomlConfig(bidlyToml);
  const secondUrl = readTomlConfig(secondToml);

  if (bidlyUrl) {
    console.log(`\n✅ shopify.app.bidly.toml:`);
    console.log(`   Application URL: ${bidlyUrl}`);
  } else {
    console.log(`\n❌ shopify.app.bidly.toml: Could not read application_url`);
  }

  if (secondUrl) {
    console.log(`\n✅ shopify.app.second.toml:`);
    console.log(`   Application URL: ${secondUrl}`);
  } else {
    console.log(`\n❌ shopify.app.second.toml: Could not read application_url`);
  }

  // Test URLs
  console.log('\n🌐 Testing URL Accessibility:\n');

  const urlsToTest = [];
  if (bidlyUrl) urlsToTest.push({ name: 'Bidly App', url: bidlyUrl });
  if (secondUrl) urlsToTest.push({ name: 'Second App', url: secondUrl });

  for (const { name, url } of urlsToTest) {
    console.log(`Testing ${name}: ${url}`);
    const result = await testUrl(url);
    
    if (result.success) {
      console.log(`  ✅ SUCCESS - Status: ${result.statusCode}, Response Time: ${result.responseTime}ms`);
      console.log(`  📦 Server: ${result.headers.server || 'Unknown'}`);
    } else {
      console.log(`  ❌ FAILED - ${result.error}`);
      if (result.code === 'ENOTFOUND' || result.code === 'EAI_AGAIN') {
        console.log(`  ⚠️  DNS Error: Domain cannot be resolved`);
        console.log(`  💡 Action: Check if the domain exists and DNS is configured correctly`);
      } else if (result.code === 'ETIMEDOUT' || result.code === 'ECONNREFUSED') {
        console.log(`  ⚠️  Connection Error: Server is not responding`);
        console.log(`  💡 Action: Check if the server is running and accessible`);
      } else if (result.code === 'CERT_HAS_EXPIRED' || result.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        console.log(`  ⚠️  SSL Error: Certificate issue`);
        console.log(`  💡 Action: Check SSL certificate configuration`);
      }
    }
    console.log('');
  }

  // Environment variable check
  console.log('🔧 Environment Variables:');
  console.log(`   SHOPIFY_APP_URL: ${process.env.SHOPIFY_APP_URL || '❌ NOT SET'}`);
  console.log(`   APP_URL: ${process.env.APP_URL || '❌ NOT SET'}`);

  // Recommendations
  console.log('\n📝 Recommendations:');
  console.log('=' .repeat(60));
  console.log('1. Verify the URL in Shopify Partner Dashboard matches the TOML file');
  console.log('2. Ensure SHOPIFY_APP_URL environment variable is set on your server');
  console.log('3. Test the URL directly in a browser to confirm it loads');
  console.log('4. Check Render.com dashboard to ensure the service is running');
  console.log('5. Verify DNS propagation (can take up to 48 hours)');
  console.log('6. Check Render.com logs for any startup errors');
  console.log('\n💡 Once the URL resolves correctly, App Bridge and session tokens will work automatically.');
}

diagnose().catch(console.error);


