/**
 * CÔNG CỤ TỐI ƯU ẢNH: phân loại theo tiền tố tên file rồi chuyển sang WebP hoặc AVIF.
 * Ưu tiên cwebp nếu có; nếu không mặc định dùng sips để tạo AVIF.
 * --dry-run chỉ in kế hoạch, không tạo ảnh; bảng cuối so dung lượng trước/sau.
 */
/**
 * Chạy: node scripts/optimize-images.mjs <thư-mục-ảnh> [--dry-run].
 * food-/place- → spots; hero- → hero; tile- → tiles.
 * Tiền tố hero-/tile- bị bỏ khỏi tên đích; phần mở rộng phụ thuộc định dạng được chọn.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imagesRoot = path.join(projectRoot, 'source', 'frontend', 'public', 'assets', 'images');

const args = process.argv.slice(2);
const sourceDir = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');

/** Kích thước đích theo vai trò ảnh; convert dùng giá trị này cho công cụ chuyển đổi. */
const MAX_EDGE = {
  spots: 1200,
  hero: 1600,
  tiles: 1200,
};

const QUALITY = 78;

if (!sourceDir) {
  console.error('Usage: node scripts/optimize-images.mjs <source-folder> [--dry-run]');
  console.error('The folder should contain files named like the targets, for example:');
  console.error('  food-pho-bo.jpg, place-hoan-kiem-lake.jpg, hero-street-food.jpg, tile-local-food.jpg');
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  console.error(`Source folder not found: ${sourceDir}`);
  process.exit(1);
}

const hasCwebp = (() => {
  try {
    execFileSync('which', ['cwebp'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * cwebp tạo WebP; khi không có cwebp thì script mặc định chọn AVIF qua sips.
 * Có thể truyền --format=webp hoặc --format=avif.
 * Middleware phục vụ được ảnh không có đuôi theo định dạng đang tồn tại.
 */
const requested = args.find((arg) => arg.startsWith('--format='))?.split('=')[1];
const format = requested ?? (hasCwebp ? 'webp' : 'avif');

if (!['webp', 'avif'].includes(format)) {
  console.error(`Unsupported --format=${format}. Use webp or avif.`);
  process.exit(1);
}

if (format === 'webp' && !hasCwebp) {
  console.error('WebP needs cwebp on PATH. Install it with `brew install webp`, or use --format=avif.');
  process.exit(1);
}

/** Xác định thư mục và tên ảnh đích từ tiền tố của tên nguồn. */
function route(fileName) {
  const base = path.basename(fileName, path.extname(fileName));

  if (base.startsWith('hero-')) {
    return { folder: 'hero', name: base.slice('hero-'.length) };
  }
  if (base.startsWith('tile-')) {
    return { folder: 'tiles', name: base.slice('tile-'.length) };
  }
  if (base.startsWith('food-') || base.startsWith('place-')) {
    return { folder: 'spots', name: base };
  }
  return null;
}

function convert(source, destination, maxEdge) {
  if (format === 'webp') {
    execFileSync(
      'cwebp',
      ['-q', String(QUALITY), '-resize', String(maxEdge), '0', source, '-o', destination],
      { stdio: 'ignore' }
    );
    return;
  }

  // Tùy chọn -Z của sips giới hạn cạnh dài, giữ tỷ lệ ảnh.
  execFileSync(
    'sips',
    ['-Z', String(maxEdge), '-s', 'format', 'avif', '-s', 'formatOptions', String(QUALITY), source, '--out', destination],
    { stdio: 'ignore' }
  );
}

const kb = (bytes) => Math.round(bytes / 102.4) / 10;

const sources = readdirSync(sourceDir).filter((file) => /\.(jpe?g|png|tiff?|heic)$/i.test(file));

if (sources.length === 0) {
  console.error(`No JPG/PNG files found in ${sourceDir}`);
  process.exit(1);
}

console.log(`Converter: ${format === 'webp' ? 'cwebp' : 'sips (macOS built-in)'} -> .${format}`);
console.log(`Quality:   ${QUALITY}\n`);

const rows = [];
const skipped = [];

for (const file of sources) {
  const target = route(file);
  if (!target) {
    skipped.push(file);
    continue;
  }

  const source = path.join(sourceDir, file);
  const outputDir = path.join(imagesRoot, target.folder);
  const destination = path.join(outputDir, `${target.name}.${format}`);
  const before = statSync(source).size;

  if (dryRun) {
    rows.push({ file, destination: path.relative(projectRoot, destination), before, after: null });
    continue;
  }

  mkdirSync(outputDir, { recursive: true });
  convert(source, destination, MAX_EDGE[target.folder]);

  const after = statSync(destination).size;
  rows.push({ file, destination: path.relative(projectRoot, destination), before, after });
}

/* Tổng hợp dung lượng từng ảnh và mức giảm để đưa vào báo cáo. */

console.log(`| Asset | Before | After ${format.toUpperCase()} | Reduction |`);
console.log('|---|---:|---:|---:|');

let totalBefore = 0;
let totalAfter = 0;

for (const row of rows) {
  totalBefore += row.before;
  if (row.after === null) {
    console.log(`| ${row.file} | ${kb(row.before)} KB | (dry run) | — |`);
    continue;
  }
  totalAfter += row.after;
  const reduction = Math.round((1 - row.after / row.before) * 100);
  console.log(`| ${row.file} | ${kb(row.before)} KB | ${kb(row.after)} KB | ${reduction}% |`);
}

if (!dryRun && rows.length) {
  const reduction = Math.round((1 - totalAfter / totalBefore) * 100);
  console.log(`| **Total (${rows.length} files)** | **${kb(totalBefore)} KB** | **${kb(totalAfter)} KB** | **${reduction}%** |`);
}

if (skipped.length) {
  console.log(`\nSkipped ${skipped.length} file(s) with an unrecognised name prefix:`);
  skipped.forEach((file) => console.log(`  ${file}`));
  console.log('Rename them to food-*, place-*, hero-* or tile-* and run again.');
}

console.log(`\n${dryRun ? 'Dry run: nothing was written.' : `Wrote ${rows.length} .${format} file(s) into source/frontend/public/assets/images/.`}`);
console.log('Paste the table above into docs/05-testing-and-scoring.md section 5.');
