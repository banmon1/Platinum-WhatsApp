import assert from 'node:assert/strict';
import test from 'node:test';
import { AppDatabase } from '../src/database.js';

test('campaign queue persists recipient progress and completes', () => {
  const db = new AppDatabase(':memory:');
  const campaign = db.createCampaign(['962791111111', '962792222222'], 'Hello', 10) as Record<string, unknown>;
  const first = db.getDueRecipient();
  assert.equal(first?.phone, '962791111111');
  db.finishRecipient(String(first?.id), String(first?.campaign_id), true, 'wa-1');
  const saved = db.getCampaign(String(campaign.id)) as { sent:number; status:string; recipients:Array<{status:string}> };
  assert.equal(saved.sent, 1);
  assert.equal(saved.status, 'running');
  assert.equal(saved.recipients[0].status, 'sent');
  db.close();
});

test('paused campaign is not returned as due', () => {
  const db = new AppDatabase(':memory:');
  const campaign = db.createCampaign(['962791111111'], 'Hello', 10) as Record<string, unknown>;
  db.setCampaignStatus(String(campaign.id), 'paused');
  assert.equal(db.getDueRecipient(), undefined);
  db.close();
});
