'use client';

import React, { memo } from 'react';
import { Icon } from '@blueprintjs/core';
import { ImageItem } from '@/types/image';

interface ImageCardProps {
  item: ImageItem;
}

const REJECT_ICON_MAP: Record<string, React.ComponentProps<typeof Icon>['icon']> = {
  'Invalid format':                 'disable',
  'Resolution too low':             'zoom-out',
  'File too small':                 'archive',
  'No face detected':               'person',
  'Multiple faces':                 'people',
  'Image too blurry':               'eye-off',
  'Too similar to existing image':  'duplicate',
};

function ImageCard({ item }: ImageCardProps) {
  const isProcessing = item.status === 'loading' || item.status === 'validating';

  const cardClass = [
    'image-card',
    item.status === 'accepted'  ? 'accepted'   : '',
    item.status === 'rejected'  ? 'rejected'   : '',
    isProcessing                ? 'processing' : '',
  ].filter(Boolean).join(' ');

  const progressClass = isProcessing
    ? 'processing'
    : item.status === 'accepted'
    ? 'accepted'
    : 'rejected';

  return (
    <div className={cardClass}>
      {/* ---- Thumbnail ---- */}
      <div className="image-thumb-wrap">
        {/* Blueprint-toned shimmer while loading */}
        {isProcessing && <div className="image-skeleton" />}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`image-thumb ${isProcessing ? 'dim' : ''}`}
          src={item.previewUrl}
          alt={item.file.name}
        />

        {/* Spinning ring indicator while processing */}
        {isProcessing && <div className="processing-ring" />}

        {/* Corner status chip (appears when done) */}
        {item.status === 'accepted' && (
          <div className="thumb-status-chip accepted">
            <Icon icon="tick" size={12} />
            ACCEPTED
          </div>
        )}
        {item.status === 'rejected' && (
          <div className="thumb-status-chip rejected">
            <Icon icon="cross" size={12} />
            REJECTED
          </div>
        )}
      </div>

      {/* ---- Card Info ---- */}
      <div className="card-info">
        {/* Monospace filename */}
        <div className="card-filename" title={item.file.name}>
          {item.file.name}
        </div>

        {/* Progress bar */}
        <div className="bp-progress-track">
          <div
            className={`bp-progress-fill ${progressClass}`}
            style={{ width: `${item.validationProgress}%` }}
          />
        </div>

        {/* Status row */}
        <div className="card-status-row">
          {isProcessing && (
            <span className="card-status-tag processing">
              Processing
            </span>
          )}
          {item.status === 'accepted' && (
            <span className="card-status-tag accepted">
              Accepted
            </span>
          )}
          {item.status === 'rejected' && (
            <span className="card-status-tag rejected">
              Rejected
            </span>
          )}

          {/* Current validation step (right-aligned) */}
          {isProcessing && (
            <span className="card-step-label">
              {item.currentStep}
            </span>
          )}
          {!isProcessing && (
            <span className="card-step-label">
              {item.validationProgress}%
            </span>
          )}
        </div>

        {/* Reject reason inline callout */}
        {item.status === 'rejected' && item.rejectReason && (
          <div className="card-reject-reason">
            <Icon
              icon={REJECT_ICON_MAP[item.rejectReason] ?? 'warning-sign'}
              size={14}
            />
            <span>{item.rejectReason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ImageCard);
