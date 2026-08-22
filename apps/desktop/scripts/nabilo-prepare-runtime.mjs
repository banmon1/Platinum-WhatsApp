import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(desktopRoot, '..', '..');
const runtimeRoot = path.join(desktopRoot, 'nabilo-runtime');
await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });
await cp(path.join(projectRoot, 'apps', 'server', 'dist'), path.join(runtimeRoot, 'server'), { recursive: true });
await cp(path.join(projectRoot, 'apps', 'client', 'dist'), path.join(runtimeRoot, 'client'), { recursive: true });
const serverPackage = JSON.parse(await readFile(path.join(projectRoot, 'apps', 'server', 'package.json'), 'utf8'));
await writeFile(path.join(runtimeRoot, 'server', 'package.json'), JSON.stringify({ name: serverPackage.name, version: serverPackage.version, type: 'module' }, null, 2));
