/**
 * Image resolver.
 *
 * Spot and hero images are referenced without a file extension:
 *
 *   /assets/images/spots/food-pho-bo
 *
 * This middleware serves the first format that actually exists, preferring the
 * smallest, and falls back to the placeholder when the photo has not been added
 * yet. Two problems go away:
 *
 * 1. The team can produce AVIF or WebP with whatever tool their machine has.
 *    macOS `sips` writes AVIF but not WebP, `cwebp` writes WebP; either works
 *    and no source file has to be edited to match.
 * 2. A missing photo returns the placeholder with 200 instead of a broken
 *    image, so the layout never depends on a client-side onerror handler.
 *
 * Resolutions are cached, so the disk is checked once per path.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/** Smallest first: AVIF beats WebP, which beats the originals. */
const EXTENSIONS = ['.avif', '.webp', '.jpg', '.jpeg', '.png'];

const PLACEHOLDER = '/assets/images/placeholder.svg';

/**
 * requested path -> resolved path on disk, or null for the placeholder.
 *
 * Only used in production. In development nothing is cached, so adding,
 * replacing or deleting a photo takes effect without restarting the server.
 * existsSync on a handful of candidates is cheap next to sending the file.
 */
const cache = new Map();

function resolve(relativePath) {
  if (config.isProduction && cache.has(relativePath)) {
    return cache.get(relativePath);
  }

  const absoluteBase = path.join(config.publicDir, relativePath);
  const resolved =
    EXTENSIONS.map((extension) => `${absoluteBase}${extension}`).find((candidate) =>
      existsSync(candidate)
    ) ?? null;

  if (config.isProduction) {
    cache.set(relativePath, resolved);
  }
  return resolved;
}

/**
 * Handles GET /assets/images/**\/<name> with no extension. Anything with an
 * extension is left to express.static.
 */
export function resolveImage(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const requested = decodeURIComponent(req.path);
  if (!requested.startsWith('/assets/images/')) return next();
  if (path.extname(requested) !== '') return next();

  // Reject anything trying to climb out of the images folder.
  const normalised = path.posix.normalize(requested);
  if (!normalised.startsWith('/assets/images/') || normalised.includes('..')) {
    return next();
  }

  const relativePath = normalised.slice(1);
  const resolved = resolve(relativePath);

  /** No photo yet: send the placeholder and flag it, so QA can count them. */
  const sendPlaceholder = () => {
    res.set('X-Image-Placeholder', 'true');
    res.sendFile(path.join(config.publicDir, PLACEHOLDER.slice(1)), { maxAge: 0 }, (error) => {
      // The placeholder itself is missing: nothing left to do but pass on.
      if (error) next(error);
    });
  };

  if (!resolved) {
    return sendPlaceholder();
  }

  return res.sendFile(resolved, { maxAge: config.isProduction ? '30d' : 0 }, (error) => {
    if (!error) return;

    // The file disappeared between the check and the send, which happens while
    // photos are being replaced. Drop the stale entry and fall back rather than
    // turning a missing image into a 500.
    if (error.code === 'ENOENT') {
      cache.delete(relativePath);
      if (!res.headersSent) return sendPlaceholder();
      return;
    }

    next(error);
  });
}

/** Used by the asset report to list what is still missing. */
export function clearImageCache() {
  cache.clear();
}
