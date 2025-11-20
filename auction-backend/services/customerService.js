import Customer from '../models/Customer.js';
import GlobalCustomer from '../models/GlobalCustomer.js';
import generateRandomName from '../utils/generateRandomName.js';

/**
 * Ensures both global customer identity and per-store customer profile exist.
 * This is the central entry point for all customer creation/lookup.
 * 
 * @param {string} shopDomain - The shop domain
 * @param {string} email - Customer email
 * @param {string|null} firstName - Optional first name
 * @param {string|null} lastName - Optional last name
 * @param {string|null} shopifyId - Optional Shopify customer ID
 * @param {boolean} isTemp - Whether this is a temporary/guest customer (default: false)
 * @returns {Promise<Customer>} The per-store Customer document with displayName
 */
export async function ensureCustomer(shopDomain, email, firstName = null, lastName = null, shopifyId = null, isTemp = false) {
  if (!shopDomain || !email) {
    throw new Error('shopDomain and email are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Step 1: Find or create GlobalCustomer by email
  let globalCustomer = await GlobalCustomer.findOne({ email: normalizedEmail });
  
  if (!globalCustomer) {
    // Create new global customer identity
    globalCustomer = new GlobalCustomer({
      email: normalizedEmail,
      names: {
        first: firstName || null,
        last: lastName || null
      }
    });
    await globalCustomer.save();
    console.log(`✅ Created new GlobalCustomer for ${normalizedEmail}`);
  } else {
    // Update names if we have better data (non-null values)
    let shouldUpdate = false;
    if (firstName && !globalCustomer.names.first) {
      globalCustomer.names.first = firstName;
      shouldUpdate = true;
    }
    if (lastName && !globalCustomer.names.last) {
      globalCustomer.names.last = lastName;
      shouldUpdate = true;
    }
    if (shouldUpdate) {
      await globalCustomer.save();
    }
  }

  // Step 2: Find or create per-store Customer profile
  let customer = await Customer.findOne({
    email: normalizedEmail,
    shopDomain
  });

  if (!customer) {
    // Create new per-store customer profile
    // Always generate a random displayName for new store profiles
    const displayName = generateRandomName();
    
    customer = new Customer({
      globalCustomerId: globalCustomer._id,
      email: normalizedEmail,
      shopDomain,
      firstName: firstName || null,
      lastName: lastName || null,
      displayName: displayName,
      shopifyId: shopifyId || null,
      isTemp: isTemp,
      lastLoginAt: new Date()
    });
    
    await customer.save();
    console.log(`✅ Created new Customer profile for ${normalizedEmail} in shop ${shopDomain} with displayName: ${displayName}`);
  } else {
    // Ensure existing customer has globalCustomerId (migration for old customers)
    if (!customer.globalCustomerId) {
      customer.globalCustomerId = globalCustomer._id;
      await customer.save();
    }
    // Update existing customer profile if needed
    let shouldUpdate = false;
    
    // Update firstName/lastName if provided and different
    if (firstName !== null && customer.firstName !== firstName) {
      customer.firstName = firstName;
      shouldUpdate = true;
    }
    if (lastName !== null && customer.lastName !== lastName) {
      customer.lastName = lastName;
      shouldUpdate = true;
    }
    
    // Update shopifyId if provided and different
    if (shopifyId && customer.shopifyId !== shopifyId) {
      customer.shopifyId = shopifyId;
      customer.isTemp = false; // If they have a shopifyId, they're not temp
      shouldUpdate = true;
    }
    
    // Ensure displayName exists (should always exist, but safety check)
    if (!customer.displayName || customer.displayName.trim() === '') {
      customer.displayName = generateRandomName();
      shouldUpdate = true;
      console.log(`⚠️ Customer ${normalizedEmail} in shop ${shopDomain} had no displayName, generated: ${customer.displayName}`);
    }
    
    // Update lastLoginAt
    customer.lastLoginAt = new Date();
    shouldUpdate = true;
    
    if (shouldUpdate) {
      await customer.save();
    }
  }

  return customer;
}

