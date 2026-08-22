import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(desktopRoot, 'assets', 'platinum-rounded.png');
const target = path.join(desktopRoot, 'assets', 'platinum.ico');
await writeFile(target, await pngToIco(await readFile(source)));
