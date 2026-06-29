import { ImageItem, RejectReason, ValidationStep } from '@/types/image';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const ALLOWED_EXTS  = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];

// Fast frontend format check before touching the network
export function validateFormat(file: File): RejectReason | null {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_MIMES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
    return 'Invalid format';
  }
  return null;
}

// Animated step labels shown while the backend processes
const STEPS: ValidationStep[] = [
  'Checking format',
  'Checking resolution',
  'Checking file size',
  'Detecting faces',
  'Checking blur',
  'Checking duplicates',
  'Complete',
];

/**
 * Sends the file to the backend validation pipeline.
 * Progress callbacks are driven by a timer so the UI feels responsive
 * while the backend crunches (face detection, etc. can take 2-4 s).
 */
export async function validateImage(
  item: ImageItem,
  sessionId: string,
  onProgress: (progress: number, step: ValidationStep) => void,
): Promise<{ passed: boolean; reason?: RejectReason; imageUrl?: string }> {
  let stepIdx = 0;
  onProgress(0, STEPS[0]!);

  // Animate progress while upload+validation happens in backend
  const timer = setInterval(() => {
    if (stepIdx < STEPS.length - 2) {
      stepIdx++;
      const pct = Math.round(((stepIdx) / (STEPS.length - 1)) * 88);
      onProgress(pct, STEPS[stepIdx]!);
    }
  }, 700);

  try {
    const formData = new FormData();
    formData.append('image', item.file);

    const res = await fetch(`${API_BASE}/api/images/upload`, {
      method: 'POST',
      headers: {
        'X-Session-Id': sessionId,
      },
      body: formData,
    });

    clearInterval(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error ?? 'Upload failed');
    }

    const data: { image: { status: string; rejectReason?: string; url?: string } } = await res.json();

    const passed  = data.image.status === 'ACCEPTED';
    const reason  = data.image.rejectReason as RejectReason | undefined;
    const imageUrl = data.image.url ?? undefined;

    return { passed, reason, imageUrl };
  } catch (err) {
    clearInterval(timer);
    console.error('[validation] API call failed:', err);
    // Graceful fallback — treat network errors as rejection
    return { passed: false, reason: 'Invalid format' };
  }
}
