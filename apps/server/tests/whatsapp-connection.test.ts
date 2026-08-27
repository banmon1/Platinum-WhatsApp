import assert from 'node:assert/strict';
import test from 'node:test';
import { planDisconnect } from '../src/whatsapp-connection.js';

test('successful QR pairing restart stays neutral and reconnects quickly', () => {
  assert.deepEqual(planDisconnect(515, 'Restart required', false), {
    state: 'connecting',
    lastError: null,
    reconnectAfterMs: 250,
  });
});

test('real disconnects remain errors while an intentional logout does not reconnect', () => {
  assert.deepEqual(planDisconnect(503, 'Service unavailable', false), {
    state: 'disconnected',
    lastError: 'Service unavailable',
    reconnectAfterMs: 4_000,
  });
  assert.deepEqual(planDisconnect(401, 'Logged out', true), {
    state: 'disconnected',
    lastError: 'Logged out',
    reconnectAfterMs: null,
  });
});
