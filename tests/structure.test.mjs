/**
 * KIỂM TRA CẤU TRÚC: duyệt mã để kiểm tra đường dẫn import, tài nguyên HTML và lệnh npm.
 * Đồng thời kiểm tra tài liệu/database không bị đặt vào public để tránh phục vụ công khai.
 */
/**
 * Các kiểm tra đường dẫn chạy trực tiếp bằng Node, không cần server hoặc trình duyệt.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'source/frontend/public');
let checks = 0;
function exists(file, label) {
  assert.ok(existsSync(file), label);
  checks += 1;
}
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
for (const folder of ['source/frontend/public/scripts', 'source/backend/src', 'tests', 'scripts']) {
  for (const file of walk(path.join(root, folder)).filter(name => /\.(m?js)$/.test(name))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      exists(path.resolve(path.dirname(file), match[1]), file + ': unresolved ' + match[1]);
    }
  }
}
for (const page of ['index.html', 'food.html', 'places.html', 'plan.html']) {
  const html = readFileSync(path.join(publicDir, page), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) {
    const url = match[1];
    if (url === '/') continue;
    exists(path.join(publicDir, url), page + ': missing asset or page ' + url);
  }
}
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const command of Object.values(pkg.scripts)) {
  for (const match of command.matchAll(/node\s+(?:--watch\s+)?([^\s]+\.(?:js|mjs))/g)) {
    exists(path.join(root, match[1]), 'Missing npm entry point: ' + match[1]);
  }
}
for (const file of walk(publicDir)) {
  assert.ok(!/\.(?:docx?|pdf|sqlite(?:-wal|-shm)?)$/i.test(file), 'Private document/database under public: ' + file);
}
console.log(checks + ' structure checks passed; no private documents or database under the static root.');
