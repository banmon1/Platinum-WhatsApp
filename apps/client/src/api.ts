export type WhatsAppState = 'disconnected' | 'connecting' | 'qr' | 'connected';
export interface WhatsAppStatus {
  state: WhatsAppState;
  qrDataUrl: string | null;
  phone: string | null;
  profileName: string | null;
  lastError: string | null;
  updatedAt: string;
}
export interface AiSettings { enabled: boolean; configured: boolean; prompt: string; model: string }
export interface Campaign {
  id: string; message: string; interval_minutes: number; status: 'running'|'paused'|'completed';
  total: number; sent: number; failed: number; next_send_at: string | null; created_at: string;
}
export interface ActivityEvent { id:string; type:string; title:string; detail:string; status:string; created_at:string }
export interface LoginResult { token: string }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

type UnauthorizedHandler = () => void | Promise<void>;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string | null = null,
    private readonly onUnauthorized?: UnauthorizedHandler,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (this.accessToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${this.accessToken}`);

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const body = await response.json().catch(() => ({})) as {error?:string;message?:string};
    if (!response.ok) {
      if (response.status === 401 && path !== '/api/auth/login') await this.onUnauthorized?.();
      throw new ApiError(body.error || body.message || `Request failed (${response.status})`, response.status);
    }
    return body as T;
  }

  login(email:string, password:string) {
    return this.request<LoginResult>('/api/auth/login', {method:'POST', body:JSON.stringify({email,password})});
  }
  logout() { return this.request<{ok:boolean}>('/api/auth/logout', {method:'POST'}); }
  health() { return this.request<{ok:boolean}>('/api/health'); }
  status() { return this.request<{whatsapp:WhatsAppStatus;ai:AiSettings}>('/api/status'); }
  connect() { return this.request<WhatsAppStatus>('/api/whatsapp/connect', { method:'POST' }); }
  disconnect() { return this.request<WhatsAppStatus>('/api/whatsapp/disconnect', { method:'POST' }); }
  campaigns() { return this.request<Campaign[]>('/api/campaigns'); }
  createCampaign(numbers:string[], message:string) {
    return this.request<{campaign:Campaign;invalid:string[]}>('/api/campaigns', { method:'POST', body:JSON.stringify({numbers,message}) });
  }
  campaignAction(id:string, action:'stop'|'resume') { return this.request<Campaign>(`/api/campaigns/${id}/${action}`, {method:'POST'}); }
  aiSettings() { return this.request<AiSettings>('/api/ai/settings'); }
  saveAiSettings(settings:{enabled:boolean;prompt:string;model:string;apiKey?:string}) {
    return this.request<AiSettings>('/api/ai/settings', {method:'PUT', body:JSON.stringify(settings)});
  }
  activity() { return this.request<ActivityEvent[]>('/api/activity'); }
}
