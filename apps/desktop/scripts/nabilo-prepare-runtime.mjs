import JavaScriptObfuscator from 'javascript-obfuscator';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(desktopRoot, '..', '..');
const runtimeRoot = path.join(desktopRoot, 'nabilo-runtime');
const protectedRoot = path.join(desktopRoot, 'nabilo-protected');
const serverDist = path.join(projectRoot, 'apps', 'server', 'dist');
const clientDist = path.join(projectRoot, 'apps', 'client', 'dist');

const sharedObfuscation = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  sourceMap: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.72,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

const nodeObfuscation = {
  ...sharedObfuscation,
  splitStrings: true,
  splitStringsChunkLength: 8,
  target: 'node',
};

const desktopObfuscation = {
  ...nodeObfuscation,
  renameGlobals: true,
};

const browserObfuscation = {
  ...sharedObfuscation,
  splitStrings: false,
  stringArrayThreshold: 0.35,
  target: 'browser-no-eval',
  transformObjectKeys: false,
};

function keepCompiledServerFile(source) {
  const relative = path.relative(serverDist, source);
  const segments = relative.split(path.sep);
  return !segments.includes('tests') && !source.endsWith('.map') && !source.endsWith('.d.ts');
}

function keepClientFile(source) {
  return !source.endsWith('.map');
}

async function listJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(resolved));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(resolved);
  }
  return files;
}

async function obfuscate(sourcePath, destinationPath, options) {
  const source = await readFile(sourcePath, 'utf8');
  const protectedCode = JavaScriptObfuscator.obfuscate(source, options).getObfuscatedCode();
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, protectedCode);
}

await Promise.all([
  rm(runtimeRoot, { recursive: true, force: true }),
  rm(protectedRoot, { recursive: true, force: true }),
]);
await Promise.all([
  mkdir(runtimeRoot, { recursive: true }),
  mkdir(protectedRoot, { recursive: true }),
]);

await cp(serverDist, path.join(runtimeRoot, 'server'), { recursive: true, filter: keepCompiledServerFile });
await cp(clientDist, path.join(runtimeRoot, 'client'), { recursive: true, filter: keepClientFile });
const serverPackage = JSON.parse(await readFile(path.join(projectRoot, 'apps', 'server', 'package.json'), 'utf8'));
await writeFile(
  path.join(runtimeRoot, 'server', 'package.json'),
  JSON.stringify({ name: serverPackage.name, version: serverPackage.version, type: 'module' }, null, 2),
);

const serverJavaScript = await listJavaScriptFiles(path.join(runtimeRoot, 'server', 'src'));
for (const file of serverJavaScript) await obfuscate(file, file, nodeObfuscation);

const clientJavaScript = await listJavaScriptFiles(path.join(runtimeRoot, 'client'));
for (const file of clientJavaScript) await obfuscate(file, file, browserObfuscation);

await obfuscate(
  path.join(desktopRoot, 'src', 'main.mjs'),
  path.join(protectedRoot, 'main.mjs'),
  desktopObfuscation,
);
await obfuscate(
  path.join(desktopRoot, 'src', 'preload.cjs'),
  path.join(protectedRoot, 'preload.cjs'),
  desktopObfuscation,
);

console.log(`Protected ${serverJavaScript.length + clientJavaScript.length + 2} JavaScript files in nabilo runtime.`);
