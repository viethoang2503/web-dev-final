/**
 * API benchmark for PERF-04 / docs/05 section 6.
 *
 *   node tests/benchmark.mjs [baseUrl] [--runs=3]
 *
 * Measures the read-only catalogue endpoints at 1, 20 and 50 concurrent
 * requests. Each scenario runs several times and the median run is reported,
 * because a single run on a laptop is mostly noise.
 *
 * What this is: a classroom comparison on one machine, over loopback, against
 * SQLite with 20 rows. It says the API is not accidentally slow. It says
 * nothing about production scalability, and it deliberately leaves
 * register/login alone so the database is not polluted (docs/05 section 6).
 */

import http from 'node:http';

const args = process.argv.slice(2);
const rawBase = (args.find((arg) => !arg.startsWith('--')) ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const runsPerScenario = Number(args.find((arg) => arg.startsWith('--runs='))?.split('=')[1] ?? 3);

/**
 * "localhost" is dual-stack on macOS, and opening many connections to it at
 * once makes some of them wait on the IPv6-then-IPv4 fallback timer. That shows
 * up as ~200 ms spikes that have nothing to do with the server. Measuring
 * against 127.0.0.1 keeps the numbers about the API.
 */
const base = rawBase.replace('//localhost:', '//127.0.0.1:');
const target = new URL(base);

const ENDPOINTS = [
  { label: 'GET /api/spots', path: '/api/spots' },
  { label: 'GET /api/spots?kind=food', path: '/api/spots?kind=food' },
  { label: 'GET /api/spots?kind=place', path: '/api/spots?kind=place' },
];

const CONCURRENCY_LEVELS = [1, 20, 50];

/** Requests sent per scenario. Enough samples to be meaningful, quick to run. */
const REQUESTS_PER_SCENARIO = 200;

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * One request, timed, over a keep-alive agent.
 *
 * node:http with an explicit agent is used instead of fetch so the number of
 * sockets is known and connection setup is not re-measured on every request.
 * The body is drained, so the timing includes transferring the response.
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
 * Keep exactly `concurrency` requests in flight until `total` have been sent.
 * A plain Promise.all of 200 would measure a burst, not sustained concurrency.
 */
async function runScenario(path, concurrency, total) {
  const samples = [];
  let failed = 0;
  let sent = 0;

  // One socket per concurrent worker, reused for the whole scenario.
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });

  const worker = async () => {
    while (sent < total) {
      sent += 1;
      const result = await timeOne(path, agent);
      samples.push(result.ms);
      if (!result.ok) failed += 1;
    }
  };

  // Open the sockets before timing starts.
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
  // The first requests pay for module loading and the first SQLite read;
  // excluding them stops that one-off cost being reported as latency.
  const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });
  for (let index = 0; index < 30; index += 1) {
    await timeOne('/api/spots', agent);
  }
  agent.destroy();
}

/* --- run --------------------------------------------------------------- */

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
      // Let the server settle between runs.
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

/* --- markdown table, ready to paste into docs/05 ----------------------- */

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
