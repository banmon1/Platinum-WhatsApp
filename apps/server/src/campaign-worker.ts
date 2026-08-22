import { database, type AppDatabase } from './database.js';
import { whatsapp, type WhatsAppService } from './whatsapp.js';

export class CampaignWorker {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly db: AppDatabase = database,
    private readonly wa: WhatsAppService = whatsapp,
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), 2_000);
    void this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.busy || this.wa.getStatus().state !== 'connected') return;
    const due = this.db.getDueRecipient();
    if (!due) return;
    this.busy = true;
    const recipientId = String(due.id);
    const campaignId = String(due.campaign_id);
    const phone = String(due.phone);
    try {
      const messageId = await this.wa.sendText(phone, String(due.message));
      this.db.finishRecipient(recipientId, campaignId, true, messageId);
      this.db.addEvent('message', 'Message sent', `+${phone}`, 'sent');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.db.finishRecipient(recipientId, campaignId, false, undefined, detail);
      this.db.addEvent('message', 'Message failed', `+${phone} · ${detail}`, 'failed');
    } finally {
      this.busy = false;
    }
  }
}

export const campaignWorker = new CampaignWorker();
