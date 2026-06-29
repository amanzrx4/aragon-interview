import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ImageItem, ValidationStep } from '@/types/image';
import { validateFormat, validateImage } from '@/services/validation';

export function useImageUpload() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session ID lives in a useRef so it is:
  //   - Stable across re-renders (ref doesn't change)
  //   - Fresh on every component mount (page load / hard refresh)
  //   - NOT shared across module cache (unlike a module-level const)
  const sessionIdRef = useRef<string>(uuidv4());
  const sessionId = sessionIdRef.current;

  const updateImage = useCallback((id: string, patch: Partial<ImageItem>) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    );
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const id = uuidv4();
      const previewUrl = URL.createObjectURL(file);

      // 1. Instant frontend format check
      const formatError = validateFormat(file);

      const newItem: ImageItem = {
        id,
        file,
        previewUrl,
        status: 'loading',
        validationProgress: 0,
        currentStep: 'Checking format',
        panel: 'accepted',
      };

      setImages((prev) => [...prev, newItem]);

      if (formatError) {
        await new Promise((r) => setTimeout(r, 300));
        updateImage(id, {
          status: 'rejected',
          validationProgress: 100,
          currentStep: 'Complete',
          rejectReason: formatError,
          panel: 'rejected',
        });
        return;
      }

      // 2. Call backend pipeline (upload + all 6 validations)
      try {
        const { passed, reason, imageUrl } = await validateImage(
          newItem,
          sessionId,
          (progress: number, step: ValidationStep) => {
            updateImage(id, {
              status: 'validating',
              validationProgress: progress,
              currentStep: step,
            });
          },
        );

        updateImage(id, {
          status: passed ? 'accepted' : 'rejected',
          validationProgress: 100,
          currentStep: 'Complete',
          rejectReason: reason,
          panel: passed ? 'accepted' : 'rejected',
          ...(imageUrl ? { previewUrl: imageUrl } : {}),
        });
      } catch {
        updateImage(id, {
          status: 'rejected',
          validationProgress: 100,
          currentStep: 'Complete',
          rejectReason: 'Invalid format',
          panel: 'rejected',
        });
      }
    },
    [updateImage, sessionId],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((f) => processFile(f));
    },
    [processFile],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const acceptedImages = images.filter((i) => i.panel === 'accepted');
  const rejectedImages = images.filter((i) => i.panel === 'rejected');
  const processingCount = images.filter(
    (i) => i.status === 'loading' || i.status === 'validating',
  ).length;

  return {
    images,
    acceptedImages,
    rejectedImages,
    processingCount,
    isDragging,
    fileInputRef,
    sessionId,           // exposed so page.tsx can display it
    openFilePicker,
    onFileInputChange,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}
