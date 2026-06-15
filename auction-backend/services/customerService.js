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
export async function ensureCustomer(shopDomain, email, firstName = null, lastName = null, shopifyId = null, isTemp = false, phone = null) {
  if (!shopDomain || !email) {
    throw new Error('shopDomain and email are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Step 1: Find or create GlobalCustomer by email. Atomic upsert avoids the
  // duplicate-key race when two first-time requests for the same email arrive
  // concurrently (e.g. a customer's first bid double-fires). (SVC-16)
  let globalCustomer = await GlobalCustomer.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $setOnInsert: {
        email: normalizedEmail,
        names: { first: firstName || null, last: lastName || null }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Fill in missing global names if we now have better data
  const globalNameUpdate = {};
  if (firstName && !globalCustomer.names?.first) globalNameUpdate['names.first'] = firstName;
  if (lastName && !globalCustomer.names?.last) globalNameUpdate['names.last'] = lastName;
  if (Object.keys(globalNameUpdate).length > 0) {
    globalCustomer = await GlobalCustomer.findByIdAndUpdate(
      globalCustomer._id,
      { $set: globalNameUpdate },
      { new: true }
    );
  }

  // Step 2: Find or create per-store Customer profile (atomic upsert). displayName is
  // generated once on insert only. (SVC-16)
  let customer = await Customer.findOneAndUpdate(
    { email: normalizedEmail, shopDomain },
    {
      $setOnInsert: {
        globalCustomerId: globalCustomer._id,
        email: normalizedEmail,
        shopDomain,
        firstName: firstName || null,
        lastName: lastName || null,
        displayName: generateRandomName(normalizedEmail),
        shopifyId: shopifyId || null,
        isTemp: isTemp,
        phone: phone || null,
        lastLoginAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Update profile fields where we now have better data. Idempotent for a freshly
  // inserted doc (those values were just set via $setOnInsert).
  let shouldUpdate = false;

  // Ensure existing customer has globalCustomerId (migration for old customers)
  if (!customer.globalCustomerId) {
    customer.globalCustomerId = globalCustomer._id;
    shouldUpdate = true;
  }
  if (firstName !== null && customer.firstName !== firstName) {
    customer.firstName = firstName;
    shouldUpdate = true;
  }
  if (lastName !== null && customer.lastName !== lastName) {
    customer.lastName = lastName;
    shouldUpdate = true;
  }
  if (phone !== null && customer.phone !== phone) {
    customer.phone = phone;
    shouldUpdate = true;
  }
  if (shopifyId && customer.shopifyId !== shopifyId) {
    customer.shopifyId = shopifyId;
    customer.isTemp = false; // If they have a shopifyId, they're not temp
    shouldUpdate = true;
  }
  // Safety: displayName should always exist
  if (!customer.displayName || customer.displayName.trim() === '') {
    customer.displayName = generateRandomName(normalizedEmail);
    shouldUpdate = true;
  }

  // Always refresh lastLoginAt
  customer.lastLoginAt = new Date();
  shouldUpdate = true;

  if (shouldUpdate) {
    await customer.save();
  }

  return customer;
}

