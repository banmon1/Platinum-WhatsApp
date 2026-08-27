import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(desktopRoot, '..', '..');
const runtimeRoot = path.join(desktopRoot, 'nabilo-runtime');
const protectedRoot = path.join(desktopRoot, 'nabilo-protected');

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(resolved));
    else if (entry.isFile()) files.push(resolved);
  }
  return files;
}

const desktopPackage = JSON.parse(await readFile(path.join(desktopRoot, 'package.json'), 'utf8'));
assert.match(desktopPackage.version, /^\d+\.\d+\.\d+$/, 'Desktop package version must be valid semver.');
assert.equal(desktopPackage.main, 'nabilo-protected/main.mjs');
assert.equal(desktopPackage.build.asar, true);
assert.equal(desktopPackage.build.compression, 'maximum');
assert.equal(desktopPackage.build.extraResources, undefined);
assert.deepEqual(desktopPackage.build.electronFuses, {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  grantFileProtocolExtraPrivileges: true,
});

const runtimeFiles = await listFiles(runtimeRoot);
const protectedFiles = await listFiles(protectedRoot);
const shippedFiles = [...runtimeFiles, ...protectedFiles];
const forbidden = shippedFiles.filter((file) =>
  file.endsWith('.map') || file.endsWith('.d.ts') || file.split(path.sep).includes('tests'));
assert.deepEqual(forbidden, [], `Development artifacts leaked into runtime: ${forbidden.join(', ')}`);

const protectedMainPath = path.join(protectedRoot, 'main.mjs');
const protectedPreloadPath = path.join(protectedRoot, 'preload.cjs');
const [sourceMain, protectedMain, sourcePreload, protectedPreload] = await Promise.all([
  readFile(path.join(desktopRoot, 'src', 'main.mjs'), 'utf8'),
  readFile(protectedMainPath, 'utf8'),
  readFile(path.join(desktopRoot, 'src', 'preload.cjs'), 'utf8'),
  readFile(protectedPreloadPath, 'utf8'),
]);
assert.match(
  sourceMain,
  /fileURLToPath\(import\.meta\.url\)/,
  'Desktop root must be decoded from import.meta.url so installed paths containing spaces remain valid.',
);
assert.equal(
  sourceMain.includes('app.getAppPath()'),
  false,
  'Do not use Electron app.getAppPath() for local loadFile paths in the ESM entry point.',
);
assert.notEqual(protectedMain, sourceMain);
assert.notEqual(protectedPreload, sourcePreload);
assert.equal(protectedMain.includes('function registerWindowControls'), false);
assert.equal(protectedPreload.includes("contextBridge.exposeInMainWorld('platinumDesktop'"), false);

const clientBundles = runtimeFiles.filter((file) => file.endsWith('.js') && file.includes(`${path.sep}_expo${path.sep}`));
assert.ok(clientBundles.length > 0, 'No protected client JavaScript bundle was generated.');
for (const bundle of clientBundles) {
  const code = await readFile(bundle, 'utf8');
  const sourceBundle = await readFile(
    path.join(projectRoot, 'apps', 'client', 'dist', path.relative(path.join(runtimeRoot, 'client'), bundle)),
    'utf8',
  );
  const lineCount = code.split(/\r?\n/).length;
  assert.ok(code.length > 0);
  assert.notEqual(code, sourceBundle);
  assert.equal(code.includes('sourceMappingURL='), false);
  assert.ok(code.length / lineCount > 300, `Client bundle is not compact: ${bundle}`);
}

for (const file of shippedFiles.filter((candidate) => candidate.endsWith('.js') || candidate.endsWith('.mjs') || candidate.endsWith('.cjs'))) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `${file} failed syntax validation:\n${checked.stderr}`);
}

const nabiloTemp = await mkdtemp(path.join(os.tmpdir(), 'nabilo-hardening-'));
let runtime;
try {
  process.env.PLATINUM_DATA_DIR = nabiloTemp;
  const serverEntry = path.join(runtimeRoot, 'server', 'src', 'app.js');
  const serverModule = await import(`${pathToFileURL(serverEntry).href}?nabilo=${Date.now()}`);
  runtime = await serverModule.startPlatinumServer({
    port: 0,
    host: '127.0.0.1',
    clientDistPath: path.join(runtimeRoot, 'client'),
    autoConnectWhatsApp: false,
    sameOriginOnly: true,
  });
  const [healthResponse, clientResponse] = await Promise.all([
    fetch(`${runtime.origin}/api/health`),
    fetch(`${runtime.origin}/connect?desktop=1`),
  ]);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).ok, true);
  assert.equal(clientResponse.status, 200);
  assert.match(await clientResponse.text(), /<!DOCTYPE html>/i);
} finally {
  await runtime?.close();
  await rm(nabiloTemp, { recursive: true, force: true });
}

console.log(`Hardening verified: ${shippedFiles.length} staged files, ${clientBundles.length} compact client bundle(s).`);
