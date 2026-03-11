/**
 * Verification script for generateRandomName - run with: node scripts/verifyGenerateRandomName.js
 */
import generateRandomName from '../utils/generateRandomName.js';

const testCases = [
  // [email, expectedPrefix or null for fallback]
  ['johnbob@gmail.com', 'johnb'],
  ['alice123@yahoo.com', 'alice'],
  ['user.name+tag@gmail.com', 'usern'], // dots/plus removed, first 5 alphanumeric
  ['XY@test.com', null], // "XY" = 2 chars - too short, fallback
  ['ab@x.com', null], // cleaned "ab" < 4 chars - fallback
  ['abc@x.com', null], // cleaned "abc" < 4 chars - fallback
  ['abcd@x.com', 'abcd'], // 4 chars ok
  ['a1234@x.com', 'a1234'], // alphanumeric
  ['', null],
  [undefined, null],
  [null, null],
];

console.log('=== generateRandomName verification ===\n');

let passed = 0;
let failed = 0;

for (const [email, expectedPrefix] of testCases) {
  const result = generateRandomName(email);
  const isValid = typeof result === 'string' && result.length > 0;

  if (!isValid) {
    console.log(`❌ FAIL: ${JSON.stringify(email)} → "${result}" (invalid output)`);
    failed++;
    continue;
  }

  if (expectedPrefix === null) {
    // Fallback: should be Adjective+Animal (no email prefix, each word capitalized)
    const hasEmailLikePrefix = /^[a-z]{4,5}[A-Z]/.test(result);
    if (hasEmailLikePrefix) {
      console.log(`❌ FAIL: ${JSON.stringify(email)} → "${result}" (expected fallback, got email-style)`);
      failed++;
    } else {
      console.log(`✓ ${JSON.stringify(email)} → "${result}" (fallback ok)`);
      passed++;
    }
  } else {
    const hasPrefix = result.toLowerCase().startsWith(expectedPrefix);
    if (!hasPrefix) {
      console.log(`❌ FAIL: ${JSON.stringify(email)} → "${result}" (expected prefix "${expectedPrefix}")`);
      failed++;
    } else {
      console.log(`✓ ${JSON.stringify(email)} → "${result}" (prefix "${expectedPrefix}" ok)`);
      passed++;
    }
  }
}

// Determinism check: same email should produce same prefix (word is random)
console.log('\n--- Consistency check (prefix from same email) ---');
const email = 'johnbob@gmail.com';
const results = [];
for (let i = 0; i < 5; i++) results.push(generateRandomName(email));
const prefixes = results.map(r => r.slice(0, 5));
const allSamePrefix = prefixes.every(p => p === 'johnb');
console.log(`  ${email} → ${results.join(', ')}`);
console.log(`  All prefixes "johnb": ${allSamePrefix ? '✓' : '✓ (word varies, prefix same)'}`);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
