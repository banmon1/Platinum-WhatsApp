const {normalizeRecipient}=require('../src/phone.ts');
const assert=require('node:assert/strict');
const test=require('node:test');
test('country selector normalizes local, international and Arabic digits',()=>{
 for(const raw of ['0791234567','791234567','+962791234567','00962791234567','٠٧٩١٢٣٤٥٦٧'])assert.equal(normalizeRecipient(raw,'JO'),'+962791234567');
 assert.equal(normalizeRecipient('0501234567','AE'),'+971501234567');
 assert.equal(normalizeRecipient('0501234567','SA'),'+966501234567');
 assert.equal(normalizeRecipient('07911123456','GB'),'+447911123456');
 assert.equal(normalizeRecipient('06 6982','IT'),'+39066982');
 assert.equal(normalizeRecipient('+12025550123','JO'),'+12025550123');
 for(const raw of ['123','hello0791234567','079123456700000000','+999123456789',''])assert.equal(normalizeRecipient(raw,'JO'),null);
});

