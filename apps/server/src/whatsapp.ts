import { rmSync } from 'node:fs';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { authDir } from './config.js';
import type { WhatsAppStatus } from './types.js';

type IncomingHandler = (message: { chatId: string; text: string; externalId?: string }) => Promise<void>;

function extractText(message: WAMessage): string | null {
  const content = message.message;
  if (!content) return null;
  return content.conversation
    || content.extendedTextMessage?.text
    || content.imageMessage?.caption
    || content.videoMessage?.caption
    || null;
}

export class WhatsAppService {
  private socket: WASocket | null = null;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionallyLoggedOut = false;
  private onIncoming: IncomingHandler = async () => {};
  private status: WhatsAppStatus = {
    state: 'disconnected', qrDataUrl: null, phone: null, profileName: null,
    lastError: null, updatedAt: new Date().toISOString(),
  };

  setIncomingHandler(handler: IncomingHandler) { this.onIncoming = handler; }
  getStatus() { return { ...this.status }; }

  private update(patch: Partial<WhatsAppStatus>) {
    this.status = { ...this.status, ...patch, updatedAt: new Date().toISOString() };
  }

  async connect() {
    if (this.status.state === 'connected') return this.getStatus();
    if (!this.connecting) {
      this.connecting = this.startSocket().finally(() => { this.connecting = null; });
    }
    await this.connecting;
    return this.getStatus();
  }

  private async startSocket() {
    this.intentionallyLoggedOut = false;
    this.update({ state: 'connecting', qrDataUrl: null, lastError: null });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
      version,
      auth: state,
      browser: Browsers.windows('Platinum WhatsApp'),
      logger: pino({ level: process.env.WA_LOG_LEVEL || 'silent' }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    this.socket = socket;
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 420, color: { dark: '#1E2524', light: '#F6F6F0' } });
        this.update({ state: 'qr', qrDataUrl, lastError: null });
      }
      if (connection === 'open') {
        const phone = socket.user?.id?.split(':')[0] || null;
        this.update({ state: 'connected', qrDataUrl: null, phone, profileName: socket.user?.name || null, lastError: null });
      }
      if (connection === 'close') {
        const error = lastDisconnect?.error as { output?: { statusCode?: number }; message?: string } | undefined;
        const code = error?.output?.statusCode;
        this.socket = null;
        this.update({ state: 'disconnected', qrDataUrl: null, lastError: error?.message || (code ? `WhatsApp disconnected (${code})` : 'WhatsApp disconnected') });
        if (!this.intentionallyLoggedOut && code !== DisconnectReason.loggedOut) {
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => void this.connect(), 4_000);
        }
      }
    });
    socket.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const message of messages) {
        if (message.key.fromMe) continue;
        const chatId = message.key.remoteJid;
        if (!chatId || chatId.endsWith('@g.us') || chatId === 'status@broadcast' || chatId.endsWith('@broadcast')) continue;
        const text = extractText(message)?.trim();
        if (!text) continue;
        void this.onIncoming({ chatId, text, externalId: message.key.id || undefined });
      }
    });
  }

  async disconnect() {
    this.intentionallyLoggedOut = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const socket = this.socket;
    this.socket = null;
    if (socket) await socket.logout().catch(() => socket.end(undefined));
    rmSync(authDir, { recursive: true, force: true });
    this.update({ state: 'disconnected', qrDataUrl: null, phone: null, profileName: null, lastError: null });
    return this.getStatus();
  }

  async sendText(target: string, text: string) {
    if (!this.socket || this.status.state !== 'connected') throw new Error('WhatsApp is not connected');
    const jid = target.includes('@') ? target : `${target}@s.whatsapp.net`;
    const result = await this.socket.sendMessage(jid, { text });
    if (!result?.key?.id) throw new Error('WhatsApp did not accept the message');
    return result.key.id;
  }
}

export const whatsapp = new WhatsAppService();
