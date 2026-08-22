import OpenAI from 'openai';
import { database, type AppDatabase } from './database.js';
import { decryptSecret, encryptSecret } from './security.js';

export class AiResponder {
  constructor(private readonly db: AppDatabase = database) {}

  saveSettings(input: { enabled: boolean; prompt: string; model: string; apiKey?: string }) {
    this.db.setSetting('ai.enabled', String(input.enabled));
    this.db.setSetting('ai.prompt', input.prompt.trim());
    this.db.setSetting('ai.model', input.model.trim());
    if (input.apiKey?.trim()) this.db.setSetting('ai.apiKey', encryptSecret(input.apiKey.trim()));
    this.db.addEvent('ai', input.enabled ? 'AI replies enabled' : 'AI replies paused', input.model, input.enabled ? 'active' : 'paused');
    return this.db.getAiSettings();
  }

  async generateReply(chatId: string): Promise<string | null> {
    const settings = this.db.getAiSettings();
    const encryptedKey = this.db.getSetting('ai.apiKey');
    if (!settings.enabled || !encryptedKey) return null;

    const client = new OpenAI({ apiKey: decryptSecret(encryptedKey) });
    const history = this.db.recentMessages(chatId).map((message) => ({
      role: message.direction === 'in' ? 'user' as const : 'assistant' as const,
      content: message.body,
    }));
    const response = await client.responses.create({
      model: settings.model,
      instructions: `${settings.prompt}\n\nIf you are unsure, say so and ask a clarifying question. Do not claim an order, refund, reservation, or payment succeeded unless the customer provided explicit confirmation from the business system.`,
      input: history,
    });
    const text = response.output_text.trim();
    return text || null;
  }
}

export const aiResponder = new AiResponder();
