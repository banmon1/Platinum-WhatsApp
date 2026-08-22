import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhone, normalizePhones } from '../src/phone.js';

test('normalizes common international number formats', () => {
  assert.equal(normalizePhone('+962 79 123 4567'), '962791234567');
  assert.equal(normalizePhone('00962791234567'), '962791234567');
});

test('rejects invalid numbers and removes duplicates', () => {
  const result = normalizePhones(['+962791234567', '00962 79 123 4567', '123', '']);
  assert.deepEqual(result.valid, ['962791234567']);
  assert.deepEqual(result.invalid, ['123']);
});
