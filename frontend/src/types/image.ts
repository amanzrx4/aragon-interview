export type ImageStatus = 'loading' | 'validating' | 'accepted' | 'rejected';

export type ValidationStep =
  | 'Checking format'
  | 'Checking resolution'
  | 'Checking file size'
  | 'Detecting faces'
  | 'Checking blur'
  | 'Checking duplicates'
  | 'Complete';

export type RejectReason =
  | 'Invalid format'
  | 'Resolution too low'
  | 'File too small'
  | 'No face detected'
  | 'Multiple faces'
  | 'Image too blurry'
  | 'Too similar to existing image';

export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ImageStatus;
  validationProgress: number; // 0-100
  currentStep: ValidationStep;
  rejectReason?: RejectReason;
  panel: 'accepted' | 'rejected';
}
