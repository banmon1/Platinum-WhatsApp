import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginGuard, readBearerToken } from '../src/auth.js';

test('login sessions are random, expire, and can be revoked', () => {
  let now = 1_000;
  const guard = new LoginGuard((email, password) => email === 'owner@example.test' && password === 'correct', () => now);
  const first = guard.login('owner@example.test', 'correct');
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(guard.isAuthorized(first.token), true);
  const second = guard.login('owner@example.test', 'correct');
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.notEqual(first.token, second.token);
  assert.equal(guard.isAuthorized(first.token), false);
  assert.equal(guard.isAuthorized(second.token), true);
  guard.logout(second.token);
  assert.equal(guard.isAuthorized(second.token), false);
  const third = guard.login('owner@example.test', 'correct');
  assert.equal(third.ok, true);
  if (!third.ok) return;
  now += 25 * 60 * 60 * 1_000;
  assert.equal(guard.isAuthorized(third.token), false);
});

test('login locks briefly after repeated invalid credentials', () => {
  const guard = new LoginGuard(() => false, () => 10_000);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.deepEqual(guard.login('wrong@example.test', 'wrong', 'machine'), { ok: false });
  }
  const locked = guard.login('wrong@example.test', 'wrong', 'machine');
  assert.equal(locked.ok, false);
  assert.equal(locked.ok ? undefined : locked.retryAfterMs, 30_000);
});

test('bearer parsing accepts only a bounded URL-safe token', () => {
  const token = 'A'.repeat(43);
  assert.equal(readBearerToken(`Bearer ${token}`), token);
  assert.equal(readBearerToken(`Basic ${token}`), null);
  assert.equal(readBearerToken('Bearer short'), null);
});
