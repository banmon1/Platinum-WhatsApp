import { createServer } from 'node:http';
import { resolve } from 'node:path';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { aiResponder } from './ai.js';
import { loginGuard, readBearerToken } from './auth.js';
import { campaignWorker } from './campaign-worker.js';
import { clientOrigin } from './config.js';
import { database } from './database.js';
import { normalizePhones } from './phone.js';
import { whatsapp } from './whatsapp.js';

export interface PlatinumServerOptions {
  port?: number;
  host?: string;
  clientDistPath?: string;
  autoConnectWhatsApp?: boolean;
  sameOriginOnly?: boolean;
}

interface PlatinumAppSecurityOptions {
  sameOriginOnly?: boolean;
  onAuthenticated?: () => void;
  onLoggedOut?: () => void;
}

export function createPlatinumApp(clientDistPath?: string, security: PlatinumAppSecurityOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (security.sameOriginOnly) {
    app.use((req, res, next) => {
      const origin = req.header('origin');
      if (!origin) return next();
      try {
        if (new URL(origin).host !== req.header('host')) {
          return res.status(403).json({ error: 'Cross-origin access is not allowed.' });
        }
      } catch {
        return res.status(403).json({ error: 'Cross-origin access is not allowed.' });
      }
      next();
    });
  } else {
    app.use(cors({ origin: clientOrigin === '*' ? true : clientOrigin.split(',').map((item) => item.trim()) }));
  }
  app.use(express.json({ limit: '256kb' }));
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  const asyncRoute = (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => void handler(req, res).catch(next);

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Platinum WhatsApp API', time: new Date().toISOString() }));
  const loginSchema = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(256),
  });
  app.post('/api/auth/login', (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = loginGuard.login(input.email, input.password, req.ip || req.socket.remoteAddress || 'local');
    if (!result.ok) {
      if (result.retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(result.retryAfterMs ? 429 : 401).json({
        error: result.retryAfterMs
          ? 'Too many attempts. Please wait briefly and try again.'
          : 'The email or password is incorrect.',
        code: result.retryAfterMs ? 'LOGIN_LOCKED' : 'INVALID_CREDENTIALS',
      });
    }
    security.onAuthenticated?.();
    res.json({ token: result.token, expiresAt: result.expiresAt });
  });

  app.use('/api', (req, res, next) => {
    const token = readBearerToken(req.header('authorization'));
    if (!loginGuard.isAuthorized(token)) {
      return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
    }
    res.locals.authToken = token;
    next();
  });
  app.get('/api/auth/session', (_req, res) => res.json({ authenticated: true }));
  app.post('/api/auth/logout', (_req, res) => {
    loginGuard.logout(res.locals.authToken);
    security.onLoggedOut?.();
    res.status(204).end();
  });
  app.get('/api/status', (_req, res) => res.json({ whatsapp: whatsapp.getStatus(), ai: database.getAiSettings() }));
  app.post('/api/whatsapp/connect', asyncRoute(async (_req, res) => res.json(await whatsapp.connect())));
  app.post('/api/whatsapp/disconnect', asyncRoute(async (_req, res) => res.json(await whatsapp.disconnect())));

  const campaignSchema = z.object({ numbers: z.array(z.string()).min(1).max(500), message: z.string().trim().min(1).max(4096) });
  app.get('/api/campaigns', (_req, res) => res.json(database.listCampaigns()));
  app.get('/api/campaigns/:id', (req, res) => {
    const campaign = database.getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  });
  app.post('/api/campaigns', (req, res) => {
    const input = campaignSchema.parse(req.body);
    if (whatsapp.getStatus().state !== 'connected') return res.status(409).json({ error: 'Connect WhatsApp before starting a campaign' });
    const normalized = normalizePhones(input.numbers);
    if (!normalized.valid.length) return res.status(400).json({ error: 'No valid international phone numbers were provided', invalid: normalized.invalid });
    res.status(201).json({ campaign: database.createCampaign(normalized.valid, input.message, 10), invalid: normalized.invalid });
  });
  app.post('/api/campaigns/:id/stop', (req, res) => {
    const campaign = database.setCampaignStatus(req.params.id, 'paused');
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  });
  app.post('/api/campaigns/:id/resume', (req, res) => {
    const campaign = database.setCampaignStatus(req.params.id, 'running');
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  });

  const aiSchema = z.object({ enabled: z.boolean(), prompt: z.string().trim().min(20).max(20_000), model: z.string().trim().min(2).max(100), apiKey: z.string().trim().max(500).optional() });
  app.get('/api/ai/settings', (_req, res) => res.json(database.getAiSettings()));
  app.put('/api/ai/settings', (req, res) => res.json(aiResponder.saveSettings(aiSchema.parse(req.body))));
  app.get('/api/activity', (_req, res) => res.json(database.listEvents()));

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    for (const page of ['login', 'connect', 'campaign', 'ai', 'activity']) {
      app.get(`/${page}`, (_req, res) => res.sendFile(resolve(clientDistPath, `${page}.html`)));
    }
    app.get('/', (_req, res) => res.sendFile(resolve(clientDistPath, 'index.html')));
  }

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', issues: error.issues });
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error(error);
    res.status(500).json({ error: message });
  });
  return app;
}

let messageHandlerInstalled = false;
function installMessageHandler() {
  if (messageHandlerInstalled) return;
  messageHandlerInstalled = true;
  whatsapp.setIncomingHandler(async ({ chatId, text, externalId }) => {
    if (!database.rememberMessage(chatId, 'in', text, externalId)) return;
    database.addEvent('inbound', 'Customer message received', chatId.split('@')[0], 'received');
    try {
      const reply = await aiResponder.generateReply(chatId);
      if (!reply) return;
      const messageId = await whatsapp.sendText(chatId, reply);
      database.rememberMessage(chatId, 'out', reply, messageId);
      database.addEvent('ai', 'AI reply sent', chatId.split('@')[0], 'sent');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      database.addEvent('ai', 'AI reply failed', detail, 'failed');
    }
  });
}

export async function startPlatinumServer(options: PlatinumServerOptions = {}) {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 0;
  let protectedServicesStarted = false;
  const startProtectedServices = () => {
    if (protectedServicesStarted) return;
    protectedServicesStarted = true;
    installMessageHandler();
    campaignWorker.start();
    if (options.autoConnectWhatsApp !== false) void whatsapp.connect().catch(() => undefined);
  };
  const stopProtectedServices = () => {
    if (!protectedServicesStarted) return;
    protectedServicesStarted = false;
    campaignWorker.stop();
    whatsapp.shutdown();
  };
  const server = createServer(createPlatinumApp(options.clientDistPath, {
    sameOriginOnly: options.sameOriginOnly,
    onAuthenticated: startProtectedServices,
    onLoggedOut: stopProtectedServices,
  }));
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, host, done);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : requestedPort;
  return {
    server,
    port: actualPort,
    origin: `http://${host}:${actualPort}`,
    async close() {
      stopProtectedServices();
      await new Promise<void>((done) => server.close(() => done()));
      database.close();
    },
  };
}
