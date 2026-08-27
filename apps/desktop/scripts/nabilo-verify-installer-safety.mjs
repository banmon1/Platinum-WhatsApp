import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(desktopRoot, 'package.json'), 'utf8'));
const includePath = packageJson.build?.nsis?.include;
const includeSource = await readFile(path.join(desktopRoot, includePath), 'utf8');
const mainSource = await readFile(path.join(desktopRoot, 'src', 'main.mjs'), 'utf8');

assert.equal(packageJson.build?.nsis?.oneClick, false, 'The assisted installer must stay enabled.');
assert.equal(packageJson.build?.nsis?.allowElevation, false, 'Per-machine elevation must stay disabled.');
assert.equal(packageJson.build?.nsis?.allowToChangeInstallationDirectory, false, 'Users must not be able to select an arbitrary install folder.');
assert.equal(packageJson.build?.nsis?.deleteAppDataOnUninstall, false, 'Uninstall must preserve application data.');
assert.equal(includePath, 'build/installer.nsh', 'The installer safety include must stay wired into electron-builder.');

for (const required of [
  '!macro preInit',
  '!macro customInit',
  '!macro customUnInit',
  '$LOCALAPPDATA\\Programs\\${PRODUCT_FILENAME}',
  'StrCpy $INSTDIR',
  'Abort',
]) {
  assert.ok(includeSource.includes(required), `Missing installer safety rule: ${required}`);
}

assert.ok(
  mainSource.includes("process.env.PLATINUM_DATA_DIR = path.join(app.getPath('userData'), 'data')"),
  'Runtime data must remain outside the installation directory.',
);

console.log('Installer safety contract passed: fixed dedicated install path, guarded uninstall, and preserved AppData.');
