export type ConnectionState = 'disconnected' | 'connecting' | 'qr' | 'connected';
export type CampaignStatus = 'running' | 'paused' | 'completed';
export type RecipientStatus = 'pending' | 'sent' | 'failed';

export interface WhatsAppStatus {
  state: ConnectionState;
  qrDataUrl: string | null;
  phone: string | null;
  profileName: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface AiSettings {
  enabled: boolean;
  configured: boolean;
  prompt: string;
  model: string;
}
