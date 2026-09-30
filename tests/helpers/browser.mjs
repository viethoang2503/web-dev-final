/**
 * CÔNG CỤ TEST TRÌNH DUYỆT: mở Chrome headless bằng profile tạm, kết nối qua WebSocket/CDP.
 * Mỗi lệnh có id để ghép yêu cầu với phản hồi; page cung cấp evaluate, fill, click và key.
 * Cuối mỗi ca kiểm thử đóng trình duyệt và xóa profile tạm, không dùng hồ sơ duyệt web cá nhân.
 */
/**
 * Tiện ích Chrome DevTools Protocol dùng chung cho các bài QA.
 * WebSocket có sẵn trong Node kết nối với Chrome; withPage nhận URL, cấu hình khung nhìn
 * và callback chứa các thao tác cần kiểm thử.
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

/** Tính cổng từ pid để giảm khả năng các tiến trình test dùng trùng cổng. */
const PORT = 9400 + (process.pid % 200);

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('No Chrome/Chromium binary found. Update CHROME_CANDIDATES in tests/helpers/browser.mjs.');
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
      /* trình duyệt chưa sẵn sàng, thử lại sau */
    }
    await wait(150);
  }
  throw new Error('Chrome DevTools endpoint did not come up.');
}

/**
 * Mở một trang, chạy callback kiểm thử và luôn dọn trình duyệt ở finally.
 * viewport gồm width, height, settleMs và mã beforeLoad dùng mô phỏng lỗi.
 */
export async function withPage(url, { width = 1440, height = 900, settleMs = 2200, beforeLoad = '' } = {}, run) {
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
    // Dùng riêng cho test lỗi tải/lưu, trước khi mã ứng dụng chạy trong profile tạm.
    if (beforeLoad) await send('Page.addScriptToEvaluateOnNewDocument', { source: beforeLoad });
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });

    const page = {
      /** Chạy biểu thức trong ngữ cảnh trang web và lấy kết quả về Node. */
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

      /** Điền giá trị vào trường và phát sự kiện mà ứng dụng đang lắng nghe. */
      async fill(selector, value, eventName = 'input') {
        return page.evaluate(`
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('No element for ${selector}');
          if (!el.checkVisibility() || el.closest('[inert]') || el.disabled) throw new Error('Field is not available: ${selector}');
          el.value = ${JSON.stringify(value)};
          el.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
          return true;
        `);
      },

      /** Không cho test bấm xuyên vào panel đang ẩn hoặc điều khiển bị vô hiệu. */
      async click(selector) {
        return page.evaluate(`
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('No element for ${selector}');
          if (!el.checkVisibility() || el.closest('[inert]') || el.disabled) throw new Error('Control is not available: ${selector}');
          el.click();
          return true;
        `);
      },

      /** Gửi sự kiện bàn phím thật tới phần tử đang được focus. */
      async key(key, code = key) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key,
          code,
          windowsVirtualKeyCode: ({ Escape: 27, Tab: 9, Enter: 13, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35 })[key] ?? 0,
        });
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key,
          code,
          windowsVirtualKeyCode: ({ Escape: 27, Tab: 9, Enter: 13, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35 })[key] ?? 0,
        });
        await wait(120);
      },

      /** Chụp ảnh PNG dạng base64 để kiểm tra trạng thái giao diện khi cần. */
      async screenshot() {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        return data;
      },

      wait,

      /** Thu lỗi script/console và tách riêng lỗi tài nguyên ảnh bị thiếu. */
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

    // Chrome có thể chưa giải phóng hết file profile; thử xóa lại vài lần.
    // Nếu vẫn lỗi thì chỉ cảnh báo, không làm sai kết quả kiểm thử ứng dụng.
    await wait(150);
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      console.warn(`(could not remove temp profile ${userDataDir}: ${error.code})`);
    }
  }
}

/* Ghi nhận từng kiểm tra đạt/trượt và tổng kết mã thoát của bài QA. */

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
  if (failed) process.exitCode = 1;
  return failed;
}
