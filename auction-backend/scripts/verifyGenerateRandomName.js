/**
 * Verification script for generateRandomName - run with: node scripts/verifyGenerateRandomName.js
 */
import generateRandomName from '../utils/generateRandomName.js';

const testCases = [
  ['johnbob@gmail.com', 'johnb'],
  ['alice123@yahoo.com', 'alice'],
  ['user.name+tag@gmail.com', 'usern'],
  ['XY@test.com', 'xy'],
  ['ab@x.com', 'ab'],
  ['abc@x.com', 'abc'],
  ['abcd@x.com', 'abcd'],
  ['a1234@x.com', 'a1234'],
  ['', 'user'],
  [undefined, 'user'],
  [null, 'user'],
];

console.log('=== generateRandomName verification ===\n');

let passed = 0;
let failed = 0;

for (const [email, expected] of testCases) {
  const result = generateRandomName(email);
  if (result !== expected) {
    console.log(`❌ FAIL: ${JSON.stringify(email)} → "${result}" (expected "${expected}")`);
    failed++;
  } else {
    console.log(`✓ ${JSON.stringify(email)} → "${result}"`);
    passed++;
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
