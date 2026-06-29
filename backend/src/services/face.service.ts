/**
 * Face Detection Service
 *
 * Uses @tensorflow-models/blazeface with the pure-JS @tensorflow/tfjs CPU backend.
 * No native bindings required — avoids the util.isNullOrUndefined Node.js incompatibility.
 */

import sharp from 'sharp';

let model: any = null;
let modelLoading = false;
let modelReady = false;

export async function preloadFaceModel(): Promise<void> {
  if (modelReady || modelLoading) return;
  modelLoading = true;
  try {
    console.log('[face] Loading blazeface with pure-JS CPU backend…');
    // Pure-JS backend — no native bindings, works on any Node.js version
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    const blazeface = await import('@tensorflow-models/blazeface');
    model = await blazeface.load();
    modelReady = true;
    console.log('[face] ✓ Face detection model ready (CPU backend).');
  } catch (err) {
    console.error('[face] Model load failed:', err);
    modelReady = false;
  } finally {
    modelLoading = false;
  }
}

export interface FaceDetectionResult {
  faceCount: number;
  isFaceTooSmall: boolean;
  available: boolean;
}

const MIN_FACE_AREA_RATIO = 0.04; // face must be ≥ 4% of image area

export async function detectFaces(imageBuffer: Buffer): Promise<FaceDetectionResult> {
  if (!modelReady) {
    // Try loading now if not ready
    await preloadFaceModel();
  }

  if (!modelReady || !model) {
    console.warn('[face] Model not available — skipping face checks.');
    return { faceCount: 0, isFaceTooSmall: false, available: false };
  }

  try {
    const tf = await import('@tensorflow/tfjs');

    // Convert image to raw RGB pixels via sharp
    const { data, info } = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const imageArea = width * height;

    // Create a 3D tensor [height, width, 3]
    const tensor = tf.tensor3d(new Uint8Array(data), [height, width, 3]);

    const predictions: any[] = await model.estimateFaces(tensor, false);
    tensor.dispose();

    const faceCount = predictions.length;

    // Check if the largest detected face is big enough relative to the image
    let isFaceTooSmall = false;
    if (faceCount === 1) {
      const [topLeft, bottomRight] = [predictions[0].topLeft, predictions[0].bottomRight];
      const [x1, y1] = Array.isArray(topLeft) ? topLeft : [topLeft[0], topLeft[1]];
      const [x2, y2] = Array.isArray(bottomRight) ? bottomRight : [bottomRight[0], bottomRight[1]];
      const faceArea = Math.abs((x2 - x1) * (y2 - y1));
      isFaceTooSmall = faceArea / imageArea < MIN_FACE_AREA_RATIO;
    }

    return { faceCount, isFaceTooSmall, available: true };
  } catch (err) {
    console.error('[face] Detection error:', err);
    return { faceCount: 0, isFaceTooSmall: false, available: false };
  }
}
