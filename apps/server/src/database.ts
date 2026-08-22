import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { databasePath } from './config.js';
import type { AiSettings } from './types.js';

export class AppDatabase {
  readonly db: DatabaseSync;

  constructor(path = databasePath) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        message TEXT NOT NULL,
        interval_minutes INTEGER NOT NULL DEFAULT 10 CHECK(interval_minutes >= 1),
        status TEXT NOT NULL CHECK(status IN ('running','paused','completed')),
        total INTEGER NOT NULL,
        sent INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        next_send_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS campaign_recipients (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        position INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
        error TEXT,
        wa_message_id TEXT,
        sent_at TEXT,
        UNIQUE(campaign_id, phone)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('in','out')),
        body TEXT NOT NULL,
        external_id TEXT UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_campaigns_due
        ON campaigns(status, next_send_at) WHERE status = 'running';
      CREATE INDEX IF NOT EXISTS idx_recipients_campaign_position
        ON campaign_recipients(campaign_id, position);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_created
        ON messages(chat_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_events_created
        ON events(created_at DESC);
      PRAGMA optimize;
    `);
  }

  close() { this.db.close(); }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string) {
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key, value, now);
  }

  getAiSettings(): AiSettings {
    return {
      enabled: this.getSetting('ai.enabled') === 'true',
      configured: Boolean(this.getSetting('ai.apiKey')),
      prompt: this.getSetting('ai.prompt') || 'You are a helpful customer care assistant. Be concise, accurate, and friendly. Never invent product information.',
      model: this.getSetting('ai.model') || 'gpt-5-mini',
    };
  }

  createCampaign(numbers: string[], message: string, intervalMinutes = 10) {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.transaction(() => {
      this.db.prepare(`INSERT INTO campaigns(id,message,interval_minutes,status,total,next_send_at,created_at,updated_at)
        VALUES(?,?,?,'running',?,?,?,?)`).run(id, message, intervalMinutes, numbers.length, now, now, now);
      const insertRecipient = this.db.prepare(`INSERT INTO campaign_recipients
        (id,campaign_id,phone,position,status) VALUES(?,?,?,?, 'pending')`);
      numbers.forEach((phone, index) => insertRecipient.run(randomUUID(), id, phone, index));
    });
    this.addEvent('campaign', 'Campaign started', `${numbers.length} recipients · ${intervalMinutes} minute interval`, 'running');
    return this.getCampaign(id);
  }

  getCampaign(id: string) {
    const campaign = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!campaign) return null;
    const recipients = this.db.prepare('SELECT * FROM campaign_recipients WHERE campaign_id = ? ORDER BY position').all(id);
    return { ...campaign, recipients };
  }

  listCampaigns() {
    return this.db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 30').all();
  }

  setCampaignStatus(id: string, status: 'running' | 'paused') {
    const now = new Date().toISOString();
    const next = status === 'running' ? now : null;
    const result = this.db.prepare(`UPDATE campaigns SET status=?, next_send_at=?, updated_at=?
      WHERE id=? AND status != 'completed'`).run(status, next, now, id);
    if (result.changes) this.addEvent('campaign', status === 'running' ? 'Campaign resumed' : 'Campaign paused', id, status);
    return this.getCampaign(id);
  }

  getDueRecipient() {
    return this.db.prepare(`SELECT r.*, c.message, c.interval_minutes
      FROM campaigns c JOIN campaign_recipients r ON r.campaign_id=c.id
      WHERE c.status='running' AND c.next_send_at <= ? AND r.status='pending'
      ORDER BY c.created_at, r.position LIMIT 1`).get(new Date().toISOString()) as Record<string, unknown> | undefined;
  }

  finishRecipient(recipientId: string, campaignId: string, ok: boolean, messageId?: string, error?: string) {
    const now = new Date().toISOString();
    this.transaction(() => {
      this.db.prepare(`UPDATE campaign_recipients SET status=?, error=?, wa_message_id=?, sent_at=? WHERE id=?`)
        .run(ok ? 'sent' : 'failed', error || null, messageId || null, now, recipientId);
      this.db.prepare(`UPDATE campaigns SET sent=sent+?, failed=failed+?, updated_at=? WHERE id=?`)
        .run(ok ? 1 : 0, ok ? 0 : 1, now, campaignId);
      const pending = this.db.prepare(`SELECT COUNT(*) AS count FROM campaign_recipients
        WHERE campaign_id=? AND status='pending'`).get(campaignId) as { count: number };
      if (pending.count === 0) {
        this.db.prepare(`UPDATE campaigns SET status='completed', next_send_at=NULL, updated_at=? WHERE id=?`).run(now, campaignId);
      } else {
        const row = this.db.prepare('SELECT interval_minutes FROM campaigns WHERE id=?').get(campaignId) as { interval_minutes: number };
        const next = new Date(Date.now() + row.interval_minutes * 60_000).toISOString();
        this.db.prepare('UPDATE campaigns SET next_send_at=?, updated_at=? WHERE id=?').run(next, now, campaignId);
      }
    });
  }

  rememberMessage(chatId: string, direction: 'in' | 'out', body: string, externalId?: string) {
    try {
      this.db.prepare(`INSERT INTO messages(id,chat_id,direction,body,external_id,created_at) VALUES(?,?,?,?,?,?)`)
        .run(randomUUID(), chatId, direction, body, externalId || null, new Date().toISOString());
      return true;
    } catch (error) {
      if (String(error).includes('UNIQUE constraint failed')) return false;
      throw error;
    }
  }

  recentMessages(chatId: string, limit = 12) {
    return this.db.prepare(`SELECT direction,body,created_at FROM messages WHERE chat_id=?
      ORDER BY created_at DESC LIMIT ?`).all(chatId, limit).reverse() as Array<{direction:'in'|'out';body:string;created_at:string}>;
  }

  addEvent(type: string, title: string, detail: string, status: string) {
    this.db.prepare('INSERT INTO events(id,type,title,detail,status,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(), type, title, detail, status, new Date().toISOString());
  }

  listEvents() {
    return this.db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 100').all();
  }
}

export const database = new AppDatabase();
