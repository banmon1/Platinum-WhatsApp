import assert from 'node:assert/strict';
import test from 'node:test';
import { CampaignWorker } from '../src/campaign-worker.js';
import { AppDatabase } from '../src/database.js';
import { normalizePhones } from '../src/phone.js';
import type { WhatsAppService } from '../src/whatsapp.js';

test('invalid-format recipients are skipped while every valid recipient is queued', () => {
  const normalized = normalizePhones([
    '+962 79 111 1111',
    'not-a-number',
    '00962 79 222 2222',
    '123',
  ]);

  assert.deepEqual(normalized.invalid, ['not-a-number', '123']);
  assert.deepEqual(normalized.valid, ['962791111111', '962792222222']);

  const db = new AppDatabase(':memory:');
  try {
    const campaign = db.createCampaign(normalized.valid, 'Hello', 10) as {
      total: number;
      recipients: Array<{ phone: string; status: string }>;
    };

    assert.equal(campaign.total, 2);
    assert.deepEqual(
      campaign.recipients.map(({ phone, status }) => ({ phone, status })),
      [
        { phone: '962791111111', status: 'pending' },
        { phone: '962792222222', status: 'pending' },
      ],
    );
  } finally {
    db.close();
  }
});

test('a WhatsApp send failure marks only that recipient failed and the worker continues', async () => {
  const firstPhone = '962791111111';
  const secondPhone = '962792222222';
  const attempts: string[] = [];
  const db = new AppDatabase(':memory:');
  const campaign = db.createCampaign([firstPhone, secondPhone], 'Hello', 10) as unknown as { id: string };
  const fakeWhatsApp = {
    getStatus: () => ({
      state: 'connected' as const,
      qrDataUrl: null,
      phone: '962790000000',
      profileName: 'Test',
      lastError: null,
      updatedAt: new Date().toISOString(),
    }),
    sendText: async (phone: string) => {
      attempts.push(phone);
      if (phone === firstPhone) throw new Error('Recipient is not available on WhatsApp');
      return 'wa-second';
    },
  } as unknown as WhatsAppService;
  const worker = new CampaignWorker(db, fakeWhatsApp);

  try {
    await worker.tick();

    const afterFailure = db.getCampaign(campaign.id) as {
      sent: number;
      failed: number;
      status: string;
      recipients: Array<{ status: string; error: string | null }>;
    };
    assert.equal(afterFailure.sent, 0);
    assert.equal(afterFailure.failed, 1);
    assert.equal(afterFailure.status, 'running');
    assert.equal(afterFailure.recipients[0].status, 'failed');
    assert.match(afterFailure.recipients[0].error ?? '', /not available on WhatsApp/);
    assert.equal(afterFailure.recipients[1].status, 'pending');

    // Preserve campaign pacing, then make the next scheduled slot due without waiting ten minutes.
    db.db.prepare('UPDATE campaigns SET next_send_at=? WHERE id=?')
      .run(new Date(Date.now() - 1_000).toISOString(), campaign.id);
    await worker.tick();

    const completed = db.getCampaign(campaign.id) as {
      sent: number;
      failed: number;
      status: string;
      recipients: Array<{ status: string; wa_message_id: string | null }>;
    };
    assert.deepEqual(attempts, [firstPhone, secondPhone]);
    assert.equal(completed.sent, 1);
    assert.equal(completed.failed, 1);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.recipients[0].status, 'failed');
    assert.equal(completed.recipients[1].status, 'sent');
    assert.equal(completed.recipients[1].wa_message_id, 'wa-second');
  } finally {
    db.close();
  }
});
