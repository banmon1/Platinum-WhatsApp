import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { aiResponder } from './ai.js';
import { campaignWorker } from './campaign-worker.js';
import { clientOrigin, port } from './config.js';
import { database } from './database.js';
import { normalizePhones } from './phone.js';
import { whatsapp } from './whatsapp.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: clientOrigin === '*' ? true : clientOrigin.split(',').map((item) => item.trim()) }));
app.use(express.json({ limit: '256kb' }));

const asyncRoute = (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => void handler(req, res).catch(next);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Platinum WhatsApp API', time: new Date().toISOString() }));
app.get('/api/status', (_req, res) => res.json({ whatsapp: whatsapp.getStatus(), ai: database.getAiSettings() }));
app.post('/api/whatsapp/connect', asyncRoute(async (_req, res) => res.json(await whatsapp.connect())));
app.post('/api/whatsapp/disconnect', asyncRoute(async (_req, res) => res.json(await whatsapp.disconnect())));

const campaignSchema = z.object({
  numbers: z.array(z.string()).min(1).max(500),
  message: z.string().trim().min(1).max(4096),
});
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
  const campaign = database.createCampaign(normalized.valid, input.message, 10);
  res.status(201).json({ campaign, invalid: normalized.invalid });
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

const aiSchema = z.object({
  enabled: z.boolean(),
  prompt: z.string().trim().min(20).max(20_000),
  model: z.string().trim().min(2).max(100),
  apiKey: z.string().trim().max(500).optional(),
});
app.get('/api/ai/settings', (_req, res) => res.json(database.getAiSettings()));
app.put('/api/ai/settings', (req, res) => res.json(aiResponder.saveSettings(aiSchema.parse(req.body))));
app.get('/api/activity', (_req, res) => res.json(database.listEvents()));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', issues: error.issues });
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  console.error(error);
  res.status(500).json({ error: message });
});

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

campaignWorker.start();
void whatsapp.connect().catch(() => undefined);

const server = createServer(app);
server.listen(port, '0.0.0.0', () => console.log(`Platinum WhatsApp API ready on http://localhost:${port}`));

const shutdown = () => {
  campaignWorker.stop();
  server.close(() => {
    database.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
