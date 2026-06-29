/**
 * Validation Service
 *
 * Runs the full validation pipeline for each uploaded image:
 *  1. Format check  (MIME + extension)
 *  2. HEIC → JPEG conversion
 *  3. File size + resolution check
 *  4. Blur detection  (Laplacian variance of grayscale)
 *  5. Perceptual-hash similarity check  (dHash, hamming distance)
 *  6. Face detection  (blazeface: 0 faces → reject, >1 → reject, face too small → reject)
 */

import sharp from 'sharp';
import { getPrisma } from '../config/db';
import { detectFaces } from './face.service';

// ── Constants ──────────────────────────────────────────────────────────────────
const MIN_FILE_SIZE_BYTES       = 50 * 1024;  // 50 KB
const MIN_WIDTH                 = 256;
const MIN_HEIGHT                = 256;
const BLUR_THRESHOLD            = 80;          // Laplacian variance below this → blurry
const DHASH_SIMILARITY_THRESHOLD = 12;         // Hamming distance ≤ this → too similar

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']);
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif']);

// ── Session-scoped in-memory hash store ─────────────────────────────────────
// Keyed by sessionId (UUID sent by the frontend on page load).
// Hashes are ONLY compared within the same session so a browser refresh
// always starts with a clean slate — no bleed-through from previous uploads.
const sessionHashes = new Map<string, Set<string>>();

function getSessionSet(sessionId: string): Set<string> {
  if (!sessionHashes.has(sessionId)) {
    sessionHashes.set(sessionId, new Set());
  }
  return sessionHashes.get(sessionId)!;
}

export function getSessionDebugInfo() {
  const sessions: Record<string, { size: number; hashes: string[] }> = {};
  for (const [id, set] of sessionHashes.entries()) {
    sessions[id] = { size: set.size, hashes: [...set] };
  }
  return { sessionCount: sessionHashes.size, sessions };
}

export function clearAllSessions() {
  sessionHashes.clear();
  console.log('[debug] All session hashes cleared.');
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ProcessedImageInfo {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  blurScore: number;
  perceptualHash: string;
  faceCount: number;
}

export interface ValidationResult {
  passed: boolean;
  rejectReason?: string;
  info?: ProcessedImageInfo;
}

// ── 1. Format Validation ───────────────────────────────────────────────────────
export function validateFormat(originalName: string, mimeType: string): string | null {
  const ext = '.' + (originalName.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_MIMES.has(mimeType.toLowerCase()) && !ALLOWED_EXTS.has(ext)) {
    return 'Invalid format. Only JPG, PNG, and HEIC are accepted.';
  }
  return null;
}

// ── 2. HEIC Conversion ─────────────────────────────────────────────────────────
export async function convertIfHeic(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif';
  if (!isHeic) return { buffer, mimeType };
  const converted = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();
  return { buffer: converted, mimeType: 'image/jpeg' };
}

// ── 3. Size + Resolution Check ─────────────────────────────────────────────────
export async function checkSizeAndResolution(
  buffer: Buffer,
  fileSize: number,
): Promise<{ width: number; height: number; error: string | null }> {
  if (fileSize < MIN_FILE_SIZE_BYTES) {
    return {
      width: 0,
      height: 0,
      error: `File too small (${Math.round(fileSize / 1024)} KB). Minimum is 50 KB.`,
    };
  }

  const meta   = await sharp(buffer).metadata();
  const width  = meta.width  ?? 0;
  const height = meta.height ?? 0;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return {
      width,
      height,
      error: `Resolution too low (${width}×${height}). Minimum is ${MIN_WIDTH}×${MIN_HEIGHT}.`,
    };
  }

  return { width, height, error: null };
}

// ── 4. Blur Detection (Laplacian Variance) ─────────────────────────────────────
export async function computeBlurScore(buffer: Buffer): Promise<number> {
  const { data, info } = await sharp(buffer)
    .grayscale()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w      = info.width;
  const h      = info.height;
  const pixels = new Uint8Array(data);

  let sum = 0, sumSq = 0, count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c   = pixels[y * w + x]           ?? 0;
      const top = pixels[(y - 1) * w + x]     ?? 0;
      const bot = pixels[(y + 1) * w + x]     ?? 0;
      const lft = pixels[y * w + (x - 1)]     ?? 0;
      const rgt = pixels[y * w + (x + 1)]     ?? 0;
      const lap = top + bot + lft + rgt - 4 * c;
      sum   += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 999;
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}

// ── 5. Perceptual Hash (dHash 8×8) ────────────────────────────────────────────
export async function computePerceptualHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  let hash = '';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left  = pixels[row * 9 + col]       ?? 0;
      const right = pixels[row * 9 + (col + 1)] ?? 0;
      hash += left < right ? '1' : '0';
    }
  }

  return hash;
}

function hammingDistance(a: string, b: string): number {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/**
 * Check if `hash` is too similar to any image already accepted in this session.
 * Only compares within the same sessionId — no cross-session bleed.
 */
export function checkSimilarity(hash: string, sessionId: string): string | null {
  const set = getSessionSet(sessionId);
  console.log(`[similarity] sessionId="${sessionId.slice(0, 8)}" setSize=${set.size}`);
  for (const existingHash of set) {
    const dist = hammingDistance(hash, existingHash);
    if (dist <= DHASH_SIMILARITY_THRESHOLD) {
      console.log(`[similarity] REJECTED dist=${dist} threshold=${DHASH_SIMILARITY_THRESHOLD}`);
      return 'Too similar to an image already uploaded in this session.';
    }
  }
  return null;
}

/**
 * Reserve a hash within a session so concurrent uploads see it immediately.
 * Call right after the hash is computed (before the async DB write).
 */
export function reserveHash(hash: string, sessionId: string): void {
  getSessionSet(sessionId).add(hash);
}

/**
 * Release a reserved hash if the image was ultimately rejected.
 */
export function releaseHash(hash: string, sessionId: string): void {
  getSessionSet(sessionId).delete(hash);
}

// ── Master Pipeline ────────────────────────────────────────────────────────────
export async function runValidationPipeline(
  rawBuffer: Buffer,
  originalName: string,
  mimeType: string,
  fileSize: number,
  sessionId: string,
): Promise<ValidationResult> {
  // 1. Format
  const formatErr = validateFormat(originalName, mimeType);
  if (formatErr) return { passed: false, rejectReason: formatErr };

  // 2. HEIC → JPEG
  const { buffer, mimeType: finalMime } = await convertIfHeic(rawBuffer, mimeType);

  // 3. Size + Resolution
  const { width, height, error: sizeErr } = await checkSizeAndResolution(buffer, fileSize);
  if (sizeErr) return { passed: false, rejectReason: sizeErr };

  // 4. Blur
  const blurScore = await computeBlurScore(buffer);
  if (blurScore < BLUR_THRESHOLD) {
    return {
      passed: false,
      rejectReason: `Image is too blurry (score: ${blurScore.toFixed(1)}). Minimum required: ${BLUR_THRESHOLD}.`,
    };
  }

  // 5. Perceptual hash similarity check.
  //    IMPORTANT: check BEFORE reserving — otherwise the image finds its own
  //    hash in the set (hamming distance = 0) and rejects itself every time.
  const hash = await computePerceptualHash(buffer);

  const similarErr = checkSimilarity(hash, sessionId);
  if (similarErr) {
    return { passed: false, rejectReason: similarErr }; // nothing reserved, nothing to release
  }

  // Reserve only after the check passes so concurrent uploads with the same
  // image will be caught by their own checkSimilarity call.
  reserveHash(hash, sessionId);

  // 6. Face detection
  // IMPORTANT: if the model is unavailable we REJECT — never silently pass.
  const { faceCount, isFaceTooSmall, available } = await detectFaces(buffer);

  if (!available) {
    releaseHash(hash, sessionId);
    return {
      passed: false,
      rejectReason: 'Face detection service is not available. Please try again shortly.',
    };
  }

  if (faceCount === 0) {
    releaseHash(hash, sessionId);
    return { passed: false, rejectReason: 'No face detected. Please upload a clear portrait photo.' };
  }

  if (faceCount > 1) {
    releaseHash(hash, sessionId);
    return {
      passed: false,
      rejectReason: `Multiple faces detected (${faceCount}). Only single-face images are accepted.`,
    };
  }

  if (isFaceTooSmall) {
    releaseHash(hash, sessionId);
    return {
      passed: false,
      rejectReason: 'Detected face is too small. Please use a closer portrait.',
    };
  }

  // All checks passed — hash stays in the reserved set (accepted)
  return {
    passed: true,
    info: {
      buffer,
      mimeType: finalMime,
      width,
      height,
      blurScore,
      perceptualHash: hash,
      faceCount,
    },
  };
}
