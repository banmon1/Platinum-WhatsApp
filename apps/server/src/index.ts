import { startPlatinumServer } from './app.js';
import { port } from './config.js';

const runtime = await startPlatinumServer({ port, host: '0.0.0.0' });
console.log(`Platinum WhatsApp API ready on http://localhost:${runtime.port}`);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await runtime.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
