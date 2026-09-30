/**
 * ĐO HIỆU NĂNG API ĐỌC: thử 1, 20, 50 yêu cầu đồng thời, mỗi kịch bản 200 yêu cầu.
 * Lặp nhiều lượt và báo trung vị; p95 là mức thời gian mà khoảng 95% mẫu không vượt quá.
 * req/s là số yêu cầu xử lý mỗi giây; kết quả chỉ phản ánh điều kiện máy và dữ liệu đang chạy.
 */
/**
 * Chạy: node scripts/benchmark-api.mjs [baseUrl] [--runs=3].
 * Cần server đang chạy. Chỉ gửi GET để đo API, không sửa dữ liệu SQLite.
 */

import http from 'node:http';

const args = process.argv.slice(2);
const rawBase = (args.find((arg) => !arg.startsWith('--')) ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const runsPerScenario = Number(args.find((arg) => arg.startsWith('--runs='))?.split('=')[1] ?? 3);

/**
 * Dùng 127.0.0.1 để giảm ảnh hưởng thời gian chuyển giữa IPv6 và IPv4
 * khi máy phân giải localhost trong lúc mở nhiều kết nối.
 */
const base = rawBase.replace('//localhost:', '//127.0.0.1:');
const target = new URL(base);

const ENDPOINTS = [
  { label: 'GET /api/spots', path: '/api/spots' },
  { label: 'GET /api/spots?kind=food', path: '/api/spots?kind=food' },
  { label: 'GET /api/spots?kind=place', path: '/api/spots?kind=place' },
];

const CONCURRENCY_LEVELS = [1, 20, 50];

/** Số yêu cầu trong một lượt của mỗi kịch bản đo. */
const REQUESTS_PER_SCENARIO = 200;

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Đo thời gian một yêu cầu bằng node:http và kết nối keep-alive.
 * Đọc hết body trước khi chốt thời gian nên số đo bao gồm truyền nội dung phản hồi.
 */
function timeOne(path, agent) {
  return new Promise((resolve) => {
    const started = performance.now();

    const request = http.get(
      { host: target.hostname, port: target.port, path, agent },
      (response) => {
        response.resume();
        response.on('end', () =>
          resolve({
            ms: performance.now() - started,
            ok: response.statusCode >= 200 && response.statusCode < 400,
            status: response.statusCode,
          })
        );
      }
    );

    request.on('error', (error) =>
      resolve({ ms: performance.now() - started, ok: false, status: 0, error: error.message })
    );
  });
}

/**
 * Dùng các worker để duy trì mức đồng thời đã chọn cho đến khi gửi đủ yêu cầu.
 * Không gửi cả 200 yêu cầu cùng lúc vì như vậy không còn đúng kịch bản cần đo.
 */
async function runScenario(path, concurrency, total) {
  const samples = [];
  let failed = 0;
  let sent = 0;

  // Mỗi worker có kết nối được tái sử dụng trong suốt kịch bản.
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });

  const worker = async () => {
    while (sent < total) {
      sent += 1;
      const result = await timeOne(path, agent);
      samples.push(result.ms);
      if (!result.ok) failed += 1;
    }
  };

  // Mở kết nối trước khi bắt đầu đo.
  await Promise.all(Array.from({ length: concurrency }, () => timeOne('/api/health', agent)));

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const wallMs = performance.now() - startedAt;
  agent.destroy();

  const sorted = [...samples].sort((a, b) => a - b);

  return {
    total: samples.length,
    success: samples.length - failed,
    failed,
    avgMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    maxMs: sorted.at(-1),
    wallMs,
    throughput: (samples.length / wallMs) * 1000,
  };
}

const round = (value, digits = 2) => Number(value.toFixed(digits));

async function warmUp() {
  // Gửi trước một số yêu cầu để làm nóng hệ thống; không tính chúng vào mẫu đo chính.
  const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });
  for (let index = 0; index < 30; index += 1) {
    await timeOne('/api/spots', agent);
  }
  agent.destroy();
}

/* Chạy các kịch bản đo và in kết quả. */

const health = await timeOne('/api/health');
if (!health.ok) {
  console.error(`Cannot reach ${base}/api/health. Start the server with npm start first.`);
  process.exit(1);
}

console.log(`Hanoi Local API benchmark`);
console.log(`  target        ${base}`);
console.log(`  node          ${process.version}`);
console.log(`  platform      ${process.platform} ${process.arch}`);
console.log(`  requests      ${REQUESTS_PER_SCENARIO} per scenario, ${runsPerScenario} runs, median reported`);
console.log(`  note          single machine over loopback, classroom comparison only\n`);

await warmUp();

const results = [];

for (const endpoint of ENDPOINTS) {
  console.log(`${endpoint.label}`);
  console.log('  conc |  total | success | failed |  avg ms |  p50 |  p95 |  max |   req/s');
  console.log('  -----+--------+---------+--------+---------+------+------+------+--------');

  for (const concurrency of CONCURRENCY_LEVELS) {
    const runs = [];
    for (let run = 0; run < runsPerScenario; run += 1) {
      runs.push(await runScenario(endpoint.path, concurrency, REQUESTS_PER_SCENARIO));
      // Nghỉ ngắn giữa các lượt đo.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const summary = {
      endpoint: endpoint.label,
      concurrency,
      total: runs[0].total,
      success: Math.min(...runs.map((r) => r.success)),
      failed: Math.max(...runs.map((r) => r.failed)),
      avgMs: round(median(runs.map((r) => r.avgMs))),
      p50Ms: round(median(runs.map((r) => r.p50Ms))),
      p95Ms: round(median(runs.map((r) => r.p95Ms))),
      maxMs: round(median(runs.map((r) => r.maxMs))),
      throughput: Math.round(median(runs.map((r) => r.throughput))),
    };

    results.push(summary);

    console.log(
      `  ${String(concurrency).padStart(4)} | ${String(summary.total).padStart(6)} | ` +
        `${String(summary.success).padStart(7)} | ${String(summary.failed).padStart(6)} | ` +
        `${String(summary.avgMs).padStart(7)} | ${String(summary.p50Ms).padStart(4)} | ` +
        `${String(summary.p95Ms).padStart(4)} | ${String(summary.maxMs).padStart(4)} | ` +
        `${String(summary.throughput).padStart(7)}`
    );
  }
  console.log('');
}

/* Xuất bảng Markdown để đưa kết quả vào báo cáo kiểm thử. */

console.log('Markdown for docs/05-testing-and-scoring.md:\n');
console.log('| Endpoint | Concurrency | Total | Success | Failed | Avg ms | p95 ms | Max ms | Req/s |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const row of results) {
  console.log(
    `| \`${row.endpoint}\` | ${row.concurrency} | ${row.total} | ${row.success} | ${row.failed} | ` +
      `${row.avgMs} | ${row.p95Ms} | ${row.maxMs} | ${row.throughput} |`
  );
}

const anyFailed = results.some((row) => row.failed > 0);
console.log(`\n${anyFailed ? 'Some requests failed; investigate before reporting.' : 'No failed requests at any concurrency level.'}`);

process.exit(anyFailed ? 1 : 0);
