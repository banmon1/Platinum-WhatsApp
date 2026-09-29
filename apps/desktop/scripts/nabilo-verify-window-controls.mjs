import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const nabiloTemp = await mkdtemp(path.join(os.tmpdir(), 'nabilo-window-controls-'));
const resultPath = path.join(nabiloTemp, 'result.json');

try {
  const child = spawn(electronBinary, [
    desktopRoot,
    `--user-data-dir=${path.join(nabiloTemp, 'profile')}`,
    `--nabilo-control-test=${resultPath}`,
  ], {
    stdio: 'ignore',
    windowsHide: true,
  });
  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Window control test timed out.'));
    }, 20_000);
    const settle = (callback, value) => {
      clearTimeout(timeout);
      callback(value);
    };
    child.once('error', (error) => settle(reject, error));
    child.once('exit', (code) => settle(resolve, code));
  });
  assert.equal(exitCode, 0, 'Electron control test did not exit cleanly.');

  let resultText;
  try {
    resultText = await readFile(resultPath, 'utf8');
  } catch (error) {
    throw new Error('Electron exited without producing a control-test result.', { cause: error });
  }
  const result = JSON.parse(resultText);
  assert.equal(result.bridge, 'object', 'Desktop preload bridge is unavailable.');
  assert.equal(result.loginVisible, true, 'Login screen was not rendered.');
  assert.equal(result.windowControlsOnLogin, true, 'Window controls are missing from the login screen.');
  assert.equal(result.buttonsFound, true, 'One or more window control buttons are missing.');
  assert.equal(result.controlsRegion, 'no-drag', 'Window control container must never be draggable.');
  assert.equal(result.minimizeRegion, 'no-drag');
  assert.equal(result.maximizeRegion, 'no-drag');
  assert.equal(result.closeRegion, 'no-drag');
  assert.equal(result.topStripeUnprotectedActionableOverlapCount, 0);
  assert.equal(result.blockedActionableCount, 0, 'A visible login-screen control is blocked by another element.');
  assert.equal(result.passwordToggleWorked, true, 'Password visibility button did not receive its click.');
  assert.equal(result.loginValidationWorked, true, 'Login button did not receive its click.');
  assert.equal(result.navigationRegion, 'no-drag', 'Top navigation is still part of the draggable title bar.');
  assert.equal(result.navigationHoverWorked, true, 'Top navigation did not show its hover feedback.');
  assert.equal(result.navigationClickWorked, true, 'Top navigation did not receive its click.');
  assert.equal(result.minimized, true, 'Minimize button did not minimize the window.');
  assert.equal(result.maximized, true, 'Maximize button did not maximize the window.');
  assert.equal(result.restored, true, 'Maximize button did not restore the window.');
  console.log(`Window and top navigation controls verified: ${result.visibleActionableCount} visible login controls are reachable.`);
} finally {
  await rm(nabiloTemp, { recursive: true, force: true });
}
