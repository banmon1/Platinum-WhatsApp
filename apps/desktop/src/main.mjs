import { app, BrowserWindow, dialog, ipcMain, session, safeStorage, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises';

// Electron's ESM loader can expose an encoded app path (for example `%20` for
// the space in "Platinum WhatsApp"). Convert the module URL back to a native
// filesystem path before handing local files to BrowserWindow.loadFile().
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(desktopRoot, 'assets', 'platinum-rounded.png');
const protectedPreloadPath = path.join(desktopRoot, 'nabilo-protected', 'preload.cjs');
const desktopChromeCss = `
  body::before {
    content: '';
    position: fixed;
    z-index: 2147483647;
    inset: 0 0 auto 0;
    height: 22px;
    -webkit-app-region: drag !important;
    cursor: default !important;
  }

  [data-testid="window-drag-region"] {
    -webkit-app-region: drag !important;
    cursor: default !important;
    user-select: none;
  }

  [data-testid="window-drag-region"] :where(
    button,
    a,
    input,
    textarea,
    select,
    [role="button"],
    [role="link"],
    [contenteditable="true"]
  ),
  [data-testid="window-drag-region"] [data-testid="window-no-drag"],
  [data-testid="window-drag-region"] [data-testid="window-no-drag"] *,
  [data-testid="window-controls"],
  [data-testid="window-controls"] * {
    -webkit-app-region: no-drag !important;
    pointer-events: auto !important;
  }
`;
let mainWindow = null;
let serverRuntime = null;
let isShuttingDown = false;
const captureArgument = process.argv.find((value) => value.startsWith('--nabilo-capture-dir='));
const captureDir = captureArgument ? captureArgument.slice('--nabilo-capture-dir='.length) : null;
const controlTestArgument = process.argv.find((value) => value.startsWith('--nabilo-control-test='));
const controlTestPath = controlTestArgument ? controlTestArgument.slice('--nabilo-control-test='.length) : null;

async function createSplash() {
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
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      safeDialogs: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
  });
  hardenWebContents(splash);
  await splash.loadFile(path.join(desktopRoot, 'assets', 'splash.html'));
  await splash.webContents.executeJavaScript(`
    (async () => {
      const logo = document.getElementById('splash-logo');
      if (logo && !logo.complete) {
        await new Promise((resolve) => {
          logo.addEventListener('load', resolve, { once: true });
          logo.addEventListener('error', resolve, { once: true });
        });
      }
      if (logo?.decode) {
        try { await logo.decode(); } catch {}
      }
      document.documentElement.classList.add('ready');
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return true;
    })()
  `);
  if (!splash.isDestroyed()) splash.show();
  return splash;
}

function isTrustedMainFrame(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents || !serverRuntime) return false;
  try {
    return new URL(event.senderFrame.url).origin === new URL(serverRuntime.origin).origin;
  } catch {
    return false;
  }
}

function registerWindowControls() {
  const sessionFile = () => path.join(app.getPath('userData'), 'nabilo-session.bin');
  ipcMain.handle('session:load', async (event) => {
    if (!isTrustedMainFrame(event) || !safeStorage.isEncryptionAvailable()) return null;
    try { return safeStorage.decryptString(await readFile(sessionFile())); } catch { return null; }
  });
  ipcMain.handle('session:save', async (event, token) => {
    if (!isTrustedMainFrame(event) || typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error('Invalid session');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable.');
    await writeFile(sessionFile() + '.tmp', safeStorage.encryptString(token));
    await rename(sessionFile() + '.tmp', sessionFile());
  });
  ipcMain.handle('session:clear', async (event) => {
    if (isTrustedMainFrame(event)) await rm(sessionFile(), {force:true});
  });
  const languageFile = () => path.join(app.getPath('userData'), 'nabilo-language.txt');
  ipcMain.handle('language:load', async (event) => {
    if (!isTrustedMainFrame(event)) return 'en';
    try { return (await readFile(languageFile(), 'utf8')) === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
  });
  ipcMain.handle('language:save', async (event, language) => {
    if (isTrustedMainFrame(event) && ['ar','en'].includes(language)) await writeFile(languageFile(), language);
  });
  ipcMain.handle('contact:open', async (event) => {
    if (isTrustedMainFrame(event)) await shell.openExternal('https://wa.me/message/2JDP6KDMBVM6N1');
  });
  ipcMain.handle('window:minimize', (event) => {
    if (!isTrustedMainFrame(event)) return false;
    mainWindow.minimize();
    return true;
  });
  ipcMain.handle('window:toggle-maximize', (event) => {
    if (!isTrustedMainFrame(event)) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return true;
  });
  ipcMain.handle('window:close', (event) => {
    if (!isTrustedMainFrame(event)) return false;
    mainWindow.close();
    return true;
  });
}

function configureDefaultSession() {
  const defaultSession = session.defaultSession;
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  defaultSession.setDevicePermissionHandler(() => false);
  defaultSession.on('will-download', (event) => event.preventDefault());
}

function hardenWebContents(window, allowedOrigin = null) {
  const { webContents } = window;
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-attach-webview', (event) => event.preventDefault());
  if (allowedOrigin) {
    const isAllowedNavigation = (target) => {
      try {
        return new URL(target).origin === allowedOrigin;
      } catch {
        return false;
      }
    };
    webContents.on('will-navigate', (event, target) => {
      if (!isAllowedNavigation(target)) event.preventDefault();
    });
    webContents.on('will-redirect', (event, target) => {
      if (!isAllowedNavigation(target)) event.preventDefault();
    });
  }
  if (app.isPackaged) {
    webContents.on('before-input-event', (event, input) => {
      const blockedShortcut = input.key === 'F12'
        || (input.control && input.shift && ['I', 'J', 'C'].includes(input.key.toUpperCase()));
      if (blockedShortcut) event.preventDefault();
    });
    webContents.on('devtools-opened', () => webContents.closeDevTools());
  }
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
  const clickSelector = async (selector) => {
    const point = await mainWindow.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
    })()`);
    if (!point) return false;
    mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
    mainWindow.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    mainWindow.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    return true;
  };
  const initialRenderer = await mainWindow.webContents.executeJavaScript(`(() => {
    const drag = document.querySelector('[data-testid="window-drag-region"]');
    const controls = document.querySelector('[data-testid="window-controls"]');
    const minimize = document.querySelector('[aria-label="Minimize window"]');
    const maximize = document.querySelector('[aria-label="Maximize window"]');
    const close = document.querySelector('[aria-label="Close window"]');
    const region = (element, pseudo) => element
      ? getComputedStyle(element, pseudo).getPropertyValue('-webkit-app-region')
      : null;
    const bounds = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const actionable = [...document.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="link"]')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < 22 && rect.bottom > 0;
      });
    const visibleActionable = [...document.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="link"]')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    const blockedActionable = visibleActionable.filter((element) => {
      const rect = element.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return getComputedStyle(element).pointerEvents === 'none'
        || !target
        || !(element === target || element.contains(target) || target.contains(element));
    });
    return {
      bridge: typeof window.platinumDesktop,
      topStripeRegion: region(document.body, '::before'),
      topStripeCursor: getComputedStyle(document.body, '::before').cursor,
      topStripePointerEvents: getComputedStyle(document.body, '::before').pointerEvents,
      dragRegion: region(drag),
      dragCursor: drag ? getComputedStyle(drag).cursor : null,
      controlsRegion: region(controls),
      controlsCursor: controls ? getComputedStyle(controls).cursor : null,
      minimizeRegion: region(minimize),
      maximizeRegion: region(maximize),
      closeRegion: region(close),
      controlsBounds: bounds(controls),
      loginVisible: Boolean(document.querySelector('input[type="password"]')),
      windowControlsOnLogin: Boolean(document.querySelector('input[type="password"]') && controls),
      topStripeHeight: Number.parseFloat(getComputedStyle(document.body, '::before').height),
      topStripeActionableOverlapCount: actionable.length,
      topStripeUnprotectedActionableOverlapCount: actionable.filter((element) => region(element) !== 'no-drag').length,
      buttonsFound: Boolean(minimize && maximize && close),
      visibleActionableCount: visibleActionable.length,
      blockedActionableCount: blockedActionable.length,
    };
  })()`);
  await clickSelector('[aria-label="Show password"]');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const passwordToggleWorked = await mainWindow.webContents.executeJavaScript(
    `Boolean(document.querySelector('[aria-label="Hide password"]'))`,
  );
  await clickSelector('[role="button"]:not([aria-label])');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const loginValidationWorked = await mainWindow.webContents.executeJavaScript(
    `document.body.innerText.includes('Enter your email and password to continue.')`,
  );
  const navigationFixture = await mainWindow.webContents.executeJavaScript(`(() => {
    const drag = document.createElement('div');
    drag.dataset.testid = 'window-drag-region';
    Object.assign(drag.style, { position: 'fixed', left: '260px', top: '30px', zIndex: '2147483646' });
    const nav = document.createElement('div');
    nav.dataset.testid = 'window-no-drag';
    const button = document.createElement('button');
    button.dataset.testid = 'top-nav-button';
    button.textContent = 'Navigation test';
    button.addEventListener('click', () => { button.dataset.clicked = 'true'; });
    nav.append(button);
    drag.append(nav);
    document.body.append(drag);
    const rect = button.getBoundingClientRect();
    return {
      selector: '[data-testid="top-nav-button"]',
      region: getComputedStyle(button).getPropertyValue('-webkit-app-region'),
      backgroundBeforeHover: getComputedStyle(button).backgroundColor,
      point: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
    };
  })()`);
  mainWindow.webContents.sendInputEvent({ type: 'mouseMove', ...navigationFixture.point });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const navigationHoverBackground = await mainWindow.webContents.executeJavaScript(
    `getComputedStyle(document.querySelector('[data-testid="top-nav-button"]')).backgroundColor`,
  );
  await clickSelector(navigationFixture.selector);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const navigationClickWorked = await mainWindow.webContents.executeJavaScript(
    `document.querySelector('[data-testid="top-nav-button"]')?.dataset.clicked === 'true'`,
  );
  await clickSelector('[aria-label="Minimize window"]');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const minimized = mainWindow.isMinimized();
  mainWindow.restore();
  mainWindow.show();
  await clickSelector('[aria-label="Maximize window"]');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const maximized = mainWindow.isMaximized();
  await clickSelector('[aria-label="Maximize window"]');
  await new Promise((resolve) => setTimeout(resolve, 180));
  const restored = !mainWindow.isMaximized();
  await mkdir(path.dirname(controlTestPath), { recursive: true });
  await writeFile(controlTestPath, JSON.stringify({
    ...initialRenderer,
    passwordToggleWorked,
    loginValidationWorked,
    navigationRegion: navigationFixture.region,
    navigationHoverWorked: navigationHoverBackground !== navigationFixture.backgroundBeforeHover,
    navigationClickWorked,
    minimized,
    maximized,
    restored,
  }, null, 2));
  await clickSelector('[aria-label="Close window"]');
}

async function boot() {
  const startedAt = Date.now();
  const splash = await createSplash();
  process.env.PLATINUM_DATA_DIR = path.join(app.getPath('userData'), 'data');
  const serverModule = path.join(desktopRoot, 'nabilo-runtime', 'server', 'src', 'app.js');
  const clientDist = path.join(desktopRoot, 'nabilo-runtime', 'client');

  const { startPlatinumServer } = await import(pathToFileURL(serverModule).href);
  serverRuntime = await startPlatinumServer({
    port: 0,
    host: '127.0.0.1',
    clientDistPath: clientDist,
    autoConnectWhatsApp: true,
    sameOriginOnly: true,
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
      preload: protectedPreloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      safeDialogs: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  hardenWebContents(mainWindow, new URL(serverRuntime.origin).origin);
  await mainWindow.loadURL(`${serverRuntime.origin}/connect?desktop=1`);
  await mainWindow.webContents.insertCSS(desktopChromeCss, { cssOrigin: 'author' });
  mainWindow.webContents.on('did-finish-load', () => {
    void mainWindow?.webContents.insertCSS(desktopChromeCss, { cssOrigin: 'author' });
  });
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
    configureDefaultSession();
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
