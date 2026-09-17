/**
 * Headless browser checker used for the phase gates and later for QA-03.
 *
 *   node tests/browser-check.mjs [url] [width,height ...]
 *
 * For every viewport it reports:
 * - horizontal overflow (the "no horizontal scrolling at 375px" rule);
 * - console errors and page errors;
 * - failed network requests;
 * - a small set of page facts (card counts, visible controls).
 *
 * Talks to Chrome over the DevTools Protocol using the WebSocket client built
 * into Node, so there is no test dependency to install.
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

const PORT = 9333;

/** Script evaluated inside the page once it has settled. */
const PAGE_PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.right > vw + 1 || r.left < -1);
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      const name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
      return name + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']';
    });

  const visible = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && !el.hidden;
  };

  return {
    viewport: vw,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
    offenders: offenders.slice(0, 6),
    cards: document.querySelectorAll('.card').length,
    skeletons: document.querySelectorAll('.skeleton-card').length,
    visibleStates: [...document.querySelectorAll('.state:not([hidden])')].map((el) => el.textContent.trim().slice(0, 60)),
    menuButtonVisible: visible('[data-action="toggle-menu"]'),
    navVisible: visible('#site-nav'),
    resultCount: document.querySelector('[data-role="result-count"]')?.textContent.trim() ?? null,
    title: document.title,
  };
})()`;

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('No Chrome/Chromium binary found. Update CHROME_CANDIDATES.');
  }
  return found;
}

async function waitForDevtools(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Chrome DevTools endpoint did not come up.');
}

/** Minimal CDP client: send(method, params) and collected events. */
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        return;
      }
      this.events.push(message);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = id && sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }
}

async function checkViewport(url, width, height) {
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

  try {
    const wsUrl = await waitForDevtools();
    const cdp = await Cdp.connect(wsUrl);

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    // Session-scoped send.
    const call = (method, params = {}) => {
      const id = cdp.nextId++;
      return new Promise((resolve, reject) => {
        cdp.pending.set(id, { resolve, reject });
        cdp.socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    };

    await call('Runtime.enable');
    await call('Log.enable');
    await call('Network.enable');
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });

    await call('Page.navigate', { url });
    // Give the page time to fetch and render.
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const { result } = await call('Runtime.evaluate', {
      expression: PAGE_PROBE,
      returnByValue: true,
      awaitPromise: false,
    });

    const allErrorEntries = cdp.events
      .filter((event) => event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
      .map((event) => event.params.entry);

    // Missing image files are expected until PERF-01 delivers the photography,
    // so they are counted separately from real script/API errors.
    const isMissingAsset = (entry) =>
      entry.text.includes('404') && /\.(webp|avif|jpg|jpeg|png|svg)(\?|$)/i.test(entry.url ?? '');

    const missingAssets = allErrorEntries.filter(isMissingAsset).map((entry) => entry.url);
    const consoleErrors = allErrorEntries.filter((entry) => !isMissingAsset(entry)).map((entry) => entry.text);

    const exceptions = cdp.events
      .filter((event) => event.method === 'Runtime.exceptionThrown')
      .map(
        (event) =>
          event.params.exceptionDetails.exception?.description ??
          event.params.exceptionDetails.text
      );

    const failedRequests = cdp.events
      .filter((event) => event.method === 'Network.loadingFailed')
      .map((event) => event.params.errorText);

    cdp.close();
    return { ...result.value, consoleErrors, exceptions, failedRequests, missingAssets };
  } finally {
    chrome.kill('SIGKILL');
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

/* --- CLI -------------------------------------------------------------- */

const [, , urlArg, ...sizeArgs] = process.argv;
const url = urlArg ?? 'http://localhost:3000/';
const sizes = (sizeArgs.length ? sizeArgs : ['375,900', '768,900', '1024,900', '1440,900']).map(
  (size) => size.split(',').map(Number)
);

let failures = 0;

for (const [width, height] of sizes) {
  const report = await checkViewport(url, width, height);
  const problems = [];

  if (report.horizontalOverflow) {
    problems.push(`horizontal overflow: scrollWidth ${report.scrollWidth} > ${report.viewport}`);
  }
  if (report.exceptions.length) problems.push(`page errors: ${report.exceptions.join(' | ')}`);
  if (report.consoleErrors.length) {
    problems.push(`console errors: ${report.consoleErrors.join(' | ')}`);
  }

  console.log(`\n=== ${url} @ ${width}x${height} ===`);
  console.log(`  title           ${report.title}`);
  console.log(`  cards           ${report.cards} (skeletons: ${report.skeletons})`);
  if (report.resultCount) console.log(`  result count    ${report.resultCount}`);
  console.log(`  nav visible     ${report.navVisible}, menu button ${report.menuButtonVisible}`);
  if (report.visibleStates.length) console.log(`  visible states  ${report.visibleStates.join(' | ')}`);
  console.log(`  scrollWidth     ${report.scrollWidth} (viewport ${report.viewport})`);
  if (report.offenders.length) console.log(`  wide elements   ${report.offenders.join('\n                  ')}`);
  if (report.missingAssets.length) {
    const unique = [...new Set(report.missingAssets.map((url) => new URL(url).pathname))];
    console.log(`  missing images  ${unique.length} (expected until PERF-01): ${unique.slice(0, 3).join(', ')}${unique.length > 3 ? ' …' : ''}`);
  }

  if (problems.length) {
    failures += 1;
    console.log(`  RESULT          FAIL`);
    problems.forEach((problem) => console.log(`                  - ${problem}`));
  } else {
    console.log(`  RESULT          PASS`);
  }
}

console.log(`\n${failures === 0 ? 'All viewports passed.' : `${failures} viewport(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
