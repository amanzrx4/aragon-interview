/**
 * Image Service
 *
 * Handles all DB operations for images via Prisma,
 * plus cloud storage upload via Uploadthing UTApi.
 */

import { getPrisma } from '../config/db';

export enum ImageStatus {
  PENDING     = 'PENDING',
  PROCESSING  = 'PROCESSING',
  ACCEPTED    = 'ACCEPTED',
  REJECTED    = 'REJECTED',
}

// ── Uploadthing server-side upload ────────────────────────────────────────────
export async function uploadToCloud(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const { UTApi } = await import('uploadthing/server');
    const utapi = new UTApi();

    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const file = new File([ab], filename, { type: mimeType });
    const response = await utapi.uploadFiles(file);

    if (response.error) {
      console.error('[uploadthing] Upload error:', response.error);
      return null;
    }
    return response.data?.ufsUrl ?? response.data?.url ?? null;
  } catch (err) {
    console.error('[uploadthing] Upload failed:', err);
    return null;
  }
}

// ── DB Operations ─────────────────────────────────────────────────────────────
export async function createImageRecord(data: {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string | null;
  status: ImageStatus;
  rejectReason?: string;
  width?: number;
  height?: number;
  faceCount?: number;
  blurScore?: number;
  perceptualHash?: string;
}) {
  const db = getPrisma();
  if (!db) return { id: 'no-db', ...data };

  return db.image.create({ data });
}

export async function getAllImages() {
  const db = getPrisma();
  if (!db) return [];
  return db.image.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getImageById(id: string) {
  const db = getPrisma();
  if (!db) return null;
  return db.image.findUnique({ where: { id } });
}

export async function updateImageStatus(
  id: string,
  status: ImageStatus,
  extra: Record<string, any> = {},
) {
  const db = getPrisma();
  if (!db) return null;
  return db.image.update({ where: { id }, data: { status, ...extra } });
}

export async function deleteImageRecord(id: string) {
  const db = getPrisma();
  if (!db) return null;
  return db.image.delete({ where: { id } });
}
