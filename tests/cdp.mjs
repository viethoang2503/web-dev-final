/**
 * Minimal Chrome DevTools Protocol helper shared by the QA scripts.
 *
 * Uses the WebSocket client built into Node, so the test tooling needs no
 * npm dependency and works on any member's machine that has Chrome.
 *
 * Usage:
 *   await withPage('http://localhost:3000/', { width: 375 }, async (page) => {
 *     const value = await page.evaluate('document.title');
 *     await page.type('#filter-search', 'pho');
 *     const errors = page.errors();
 *   });
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

/** Port is offset per process so parallel runs do not collide. */
const PORT = 9400 + (process.pid % 200);

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('No Chrome/Chromium binary found. Update CHROME_CANDIDATES in tests/cdp.mjs.');
  }
  return found;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function devtoolsUrl(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      /* browser not ready yet */
    }
    await wait(150);
  }
  throw new Error('Chrome DevTools endpoint did not come up.');
}

/**
 * Open one page, run the callback, always clean up the browser.
 *
 * @param {string} url
 * @param {{ width?: number, height?: number, settleMs?: number }} viewport
 * @param {(page: object) => Promise<any>} run
 */
export async function withPage(url, { width = 1440, height = 900, settleMs = 2200 } = {}, run) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'hanoi-local-chrome-'));
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${width},${height}`,
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let socket;
  try {
    socket = new WebSocket(await devtoolsUrl());
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    let nextId = 1;
    const pending = new Map();
    const events = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        return;
      }
      events.push(message);
    });

    const rawSend = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });

    const { targetId } = await rawSend('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await rawSend('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => rawSend(method, params, sessionId);

    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });

    const page = {
      /** Evaluate an expression in the page and return the value. */
      async evaluate(expression) {
        const { result, exceptionDetails } = await send('Runtime.evaluate', {
          expression: `(() => { ${expression.includes('return') ? expression : `return (${expression});`} })()`,
          returnByValue: true,
          awaitPromise: true,
        });
        if (exceptionDetails) {
          throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
        }
        return result.value;
      },

      /** Set a field's value and fire the event the page listens for. */
      async fill(selector, value, eventName = 'input') {
        return page.evaluate(`
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('No element for ${selector}');
          el.value = ${JSON.stringify(value)};
          el.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
          return true;
        `);
      },

      /** Click through the real event path. */
      async click(selector) {
        return page.evaluate(`
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('No element for ${selector}');
          el.click();
          return true;
        `);
      },

      /** Send a real key event to the focused element (Escape, Tab, Enter). */
      async key(key, code = key) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key,
          code,
          windowsVirtualKeyCode: key === 'Escape' ? 27 : key === 'Tab' ? 9 : 13,
        });
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key,
          code,
          windowsVirtualKeyCode: key === 'Escape' ? 27 : key === 'Tab' ? 9 : 13,
        });
        await wait(120);
      },

      /** PNG screenshot as base64, handy for eyeballing a state under review. */
      async screenshot() {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        return data;
      },

      wait,

      /** Script errors and console errors, with missing images separated. */
      errors() {
        const entries = events
          .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
          .map((e) => e.params.entry);

        const isMissingAsset = (entry) =>
          entry.text.includes('404') && /\.(webp|avif|jpg|jpeg|png|svg|ico)(\?|$)/i.test(entry.url ?? '');

        return {
          console: entries.filter((e) => !isMissingAsset(e)).map((e) => e.text),
          missingAssets: [...new Set(entries.filter(isMissingAsset).map((e) => e.url))],
          exceptions: events
            .filter((e) => e.method === 'Runtime.exceptionThrown')
            .map(
              (e) =>
                e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text
            ),
        };
      },
    };

    await send('Page.navigate', { url });
    await wait(settleMs);

    return await run(page);
  } finally {
    socket?.close();
    chrome.kill('SIGKILL');

    // Chrome can still be flushing its profile when the process dies, so the
    // directory may briefly refuse to go. Retry, and never fail the run over
    // a leftover temp folder.
    await wait(150);
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      console.warn(`(could not remove temp profile ${userDataDir}: ${error.code})`);
    }
  }
}

/* --- tiny assertion helpers used by the QA scripts --------------------- */

let passed = 0;
let failed = 0;

export function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

export function summary() {
  console.log(`\n${passed} passed, ${failed} failed.`);
  return failed;
}
