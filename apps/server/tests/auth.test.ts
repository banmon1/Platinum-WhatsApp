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
  now += 91 * 24 * 60 * 60 * 1_000;
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

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('sessions survive restart without storing tokens and logout stays revoked', () => {
 const directory=mkdtempSync(join(tmpdir(),'nabilo-session-test-'));
 try {
  const file=join(directory,'sessions.json');
  const first=new LoginGuard(()=>true,()=>1000,file);
  const login=first.login('owner@example.test','test');
  assert.equal(login.ok,true); if(!login.ok)return;
  assert.equal(readFileSync(file,'utf8').includes(login.token),false);
  const restarted=new LoginGuard(()=>true,()=>1000+48*3600000,file);
  assert.equal(restarted.isAuthorized(login.token),true);
  restarted.logout(login.token);
  assert.equal(new LoginGuard(()=>true,()=>1000,file).isAuthorized(login.token),false);
 } finally { rmSync(directory,{recursive:true,force:true}); }
});
