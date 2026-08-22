import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const iconPath = path.join(currentDir, '..', 'assets', 'platinum-rounded.png');
let mainWindow = null;
let serverRuntime = null;
let isShuttingDown = false;
const captureArgument = process.argv.find((value) => value.startsWith('--nabilo-capture-dir='));
const captureDir = captureArgument ? captureArgument.slice('--nabilo-capture-dir='.length) : null;
const controlTestArgument = process.argv.find((value) => value.startsWith('--nabilo-control-test='));
const controlTestPath = controlTestArgument ? controlTestArgument.slice('--nabilo-control-test='.length) : null;

function createSplash() {
  const splash = new BrowserWindow({
    width: 430,
    height: 430,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#F5FF32',
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: false,
    icon: iconPath,
    webPreferences: { sandbox: true },
  });
  void splash.loadFile(path.join(currentDir, '..', 'assets', 'splash.html'));
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

function registerWindowControls() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
}

async function fadeSplash(splash) {
  mainWindow?.show();
  mainWindow?.focus();
  for (let step = 12; step >= 0; step -= 1) {
    if (splash.isDestroyed()) return;
    splash.setOpacity(step / 12);
    await new Promise((resolve) => setTimeout(resolve, 28));
  }
  if (!splash.isDestroyed()) splash.close();
}

async function waitForClientApi() {
  const deadline = Date.now() + 5000;
  while (mainWindow && Date.now() < deadline) {
    const state = await mainWindow.webContents.executeJavaScript(`(() => {
      const text = document.body?.innerText || '';
      if (!text) return 'loading';
      return text.includes('API offline') ? 'offline' : 'ready';
    })()`);
    if (state === 'ready') return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

async function runWindowControlTest() {
  if (!mainWindow || !controlTestPath) return;
  const clickControl = async (label) => {
    const point = await mainWindow.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector('[aria-label="${label}"]')?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
    })()`);
    if (!point) return false;
    mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
    mainWindow.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    mainWindow.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    return true;
  };
  const renderer = await mainWindow.webContents.executeJavaScript(`(() => {
    const drag = document.querySelector('[data-testid="window-drag-region"]');
    const minimize = document.querySelector('[aria-label="Minimize window"]');
    const maximize = document.querySelector('[aria-label="Maximize window"]');
    const close = document.querySelector('[aria-label="Close window"]');
    return {
      bridge: typeof window.platinumDesktop,
      dragRegion: drag ? getComputedStyle(drag).webkitAppRegion : null,
      minimizeRegion: minimize ? getComputedStyle(minimize).webkitAppRegion : null,
      buttonsFound: Boolean(minimize && maximize && close),
    };
  })()`);
  await clickControl('Minimize window');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const minimized = mainWindow.isMinimized();
  mainWindow.restore();
  mainWindow.show();
  await clickControl('Maximize window');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const maximized = mainWindow.isMaximized();
  await clickControl('Maximize window');
  await new Promise((resolve) => setTimeout(resolve, 180));
  const restored = !mainWindow.isMaximized();
  await mkdir(path.dirname(controlTestPath), { recursive: true });
  await writeFile(controlTestPath, JSON.stringify({ ...renderer, minimized, maximized, restored }, null, 2));
  await clickControl('Close window');
}

async function boot() {
  const startedAt = Date.now();
  const splash = createSplash();
  process.env.PLATINUM_DATA_DIR = path.join(app.getPath('userData'), 'data');
  const serverModule = app.isPackaged
    ? path.join(app.getAppPath(), 'nabilo-runtime', 'server', 'src', 'app.js')
    : path.resolve(currentDir, '..', 'nabilo-runtime', 'server', 'src', 'app.js');
  const clientDist = app.isPackaged
    ? path.join(process.resourcesPath, 'client')
    : path.resolve(currentDir, '..', 'nabilo-runtime', 'client');

  const { startPlatinumServer } = await import(pathToFileURL(serverModule).href);
  serverRuntime = await startPlatinumServer({
    port: 0,
    host: '127.0.0.1',
    clientDistPath: clientDist,
    autoConnectWhatsApp: true,
  });

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#F5FF32',
    icon: iconPath,
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await mainWindow.loadURL(`${serverRuntime.origin}/connect?desktop=1`);
  await waitForClientApi();
  const minimumSplashMs = 1700;
  const remaining = minimumSplashMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  if (captureDir) {
    await mkdir(captureDir, { recursive: true });
    await writeFile(path.join(captureDir, 'nabilo-splash.png'), (await splash.webContents.capturePage()).toPNG());
    await writeFile(path.join(captureDir, 'nabilo-main.png'), (await mainWindow.webContents.capturePage()).toPNG());
  }
  await fadeSplash(splash);
  if (controlTestPath) await runWindowControlTest();
  else if (captureDir) setTimeout(() => app.quit(), 250);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    registerWindowControls();
    try {
      await boot();
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      dialog.showErrorBox('Platinum WhatsApp', `The application could not start.\n\n${message}`);
      app.quit();
    }
  });
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (!serverRuntime || isShuttingDown) return;
  event.preventDefault();
  isShuttingDown = true;
  serverRuntime.close().catch(() => undefined).finally(() => app.exit(0));
});
