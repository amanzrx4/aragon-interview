/**
 * Image Controller
 *
 * POST /api/images/upload  — validate → upload to Uploadthing → persist to DB
 * GET  /api/images         — list all images
 * GET  /api/images/:id     — get single image
 * DELETE /api/images/:id   — delete image
 */

import { Request, Response } from 'express';
import { runValidationPipeline } from '../services/validation.service';
import {
  ImageStatus,
  createImageRecord,
  getAllImages,
  getImageById,
  deleteImageRecord,
  uploadToCloud,
} from '../services/image.service';
import { v4 as uuidv4 } from 'uuid';

export async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const sessionId = (req.headers['x-session-id'] as string) || 'default';
    const imageId = uuidv4();

    console.log(`[upload] file="${originalname}" sessionId="${sessionId.slice(0, 8)}"`);

    // ── Run full validation pipeline ────────────────────────────────────────
    const result = await runValidationPipeline(buffer, originalname, mimetype, size, sessionId);

    if (!result.passed) {
      // Save rejected record to DB
      const image = await createImageRecord({
        filename: imageId,
        originalName: originalname,
        mimeType: mimetype,
        size,
        status: ImageStatus.REJECTED,
        rejectReason: result.rejectReason,
      });

      res.status(200).json({
        image: {
          ...image,
          status: 'REJECTED',
          rejectReason: result.rejectReason,
        },
      });
      return;
    }

    // ── Upload accepted image to Uploadthing ────────────────────────────────
    const { info } = result;
    const ext = info!.mimeType === 'image/jpeg' ? '.jpg' : '.png';
    const cloudFilename = `${imageId}${ext}`;

    const url = await uploadToCloud(info!.buffer, cloudFilename, info!.mimeType);

    // ── Persist to DB ───────────────────────────────────────────────────────
    const image = await createImageRecord({
      filename: cloudFilename,
      originalName: originalname,
      mimeType: info!.mimeType,
      size,
      url,
      status: ImageStatus.ACCEPTED,
      width: info!.width,
      height: info!.height,
      blurScore: info!.blurScore,
      faceCount: info!.faceCount,
      perceptualHash: info!.perceptualHash,
    });

    res.status(201).json({ image });
  } catch (err) {
    console.error('[controller] uploadImage error:', err);
    res.status(500).json({ error: 'Internal server error during upload.' });
  }
}

export async function getImages(req: Request, res: Response): Promise<void> {
  try {
    const images = await getAllImages();
    res.json(images);
  } catch {
    res.status(500).json({ error: 'Failed to fetch images.' });
  }
}

export async function getImage(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const image = await getImageById(id);
    if (!image) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    res.json(image);
  } catch {
    res.status(500).json({ error: 'Failed to fetch image.' });
  }
}

export async function deleteImage(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    await deleteImageRecord(id);
    res.json({ message: 'Image deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete image.' });
  }
}
