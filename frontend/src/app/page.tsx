'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Button, Icon, Divider } from '@blueprintjs/core';
import ImageCard from '@/components/ImageCard';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTheme } from '@/contexts/ThemeContext';

// Fixed heights — change in one place only
const TOP_BAR_H   = 64;
const STATUS_BAR_H = 40;
const PANEL_HDR_H  = 48;
const CONTENT_H    = `calc(100vh - ${TOP_BAR_H + STATUS_BAR_H}px)`;
const GRID_H       = `calc(100vh - ${TOP_BAR_H + STATUS_BAR_H + PANEL_HDR_H}px)`;

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const {
    acceptedImages,
    rejectedImages,
    processingCount,
    images,
    isDragging,
    fileInputRef,
    sessionId,
    openFilePicker,
    onFileInputChange,
    onDragOver,
    onDragLeave,
    onDrop,
  } = useImageUpload();

  const [leftWidthPct, setLeftWidthPct] = useState(58);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Prevent highlighting text while dragging
      e.preventDefault();
      const newPct = (e.clientX / window.innerWidth) * 100;
      if (newPct >= 20 && newPct <= 80) {
        setLeftWidthPct(newPct);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDraggingDivider]);

  const hasRejected = rejectedImages.length > 0;
  const totalCount = images.length;
  const doneCount = images.filter(
    (i) => i.status === 'accepted' || i.status === 'rejected',
  ).length;

  const pipelineStatus = useMemo(() => {
    if (totalCount === 0) return 'idle';
    if (processingCount > 0) return 'processing';
    return 'done';
  }, [totalCount, processingCount]);

  const statusLabel = {
    idle: 'Idle — no images loaded',
    processing: `Processing ${processingCount} image${processingCount !== 1 ? 's' : ''}`,
    done: `Complete — ${doneCount} processed`,
  }[pipelineStatus];

  return (
    <div
      className="app-shell"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
        style={{ display: 'none' }}
        onChange={onFileInputChange}
      />

      {/* =====================================================
          TOP BAR
          ===================================================== */}
      <div className="top-bar" style={{ height: TOP_BAR_H, flexShrink: 0 }}>
        <div className="top-bar-left">
          <div className="brand-mark">
            <div className="brand-icon">
              <Icon icon="media" size={18} />
            </div>
            <span className="brand-name">Aragon.ai</span>
          </div>

          <div className="top-bar-divider" />
          <span className="page-title">Image Validation Pipeline</span>
        </div>

        <div className="top-bar-right">
          {totalCount > 0 && (
            <>
              <div className="metric-tag">
                <Icon icon="layers" size={14} />
                Total
                <span className="metric-val">{totalCount}</span>
              </div>
              <div className="metric-tag success">
                <Icon icon="tick-circle" size={14} />
                Accepted
                <span className="metric-val">{acceptedImages.filter(i => i.status === 'accepted').length}</span>
              </div>
              <div className="metric-tag danger">
                <Icon icon="ban-circle" size={14} />
                Rejected
                <span className="metric-val">{rejectedImages.length}</span>
              </div>
              {processingCount > 0 && (
                <div className="metric-tag warn">
                  <Icon icon="time" size={14} />
                  Processing
                  <span className="metric-val">{processingCount}</span>
                </div>
              )}
            </>
          )}

          {/* Theme toggle */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            <Icon
              icon={theme === 'dark' ? 'flash' : 'moon'}
              size={16}
            />
          </button>

          <Button
            icon="upload"
            intent="primary"
            text="Upload Images"
            onClick={openFilePicker}
            large
          />
        </div>
      </div>

      {/* =====================================================
          STATUS BAR
          ===================================================== */}
      <div className="status-bar" style={{ height: STATUS_BAR_H, flexShrink: 0 }}>
        <div className="status-item">
          <div className={`status-indicator ${pipelineStatus === 'idle' ? 'idle' : pipelineStatus === 'processing' ? 'processing' : 'done'}`} />
          <span className="status-label">Pipeline:&nbsp;</span>
          <span className="status-value">{statusLabel}</span>
        </div>

        {totalCount > 0 && (
          <div className="status-item">
            <span className="status-label">Validations:&nbsp;</span>
            <span className="status-value">
              {doneCount} / {totalCount}
            </span>
          </div>
        )}

        {totalCount > 0 && (
          <div className="status-item">
            <span className="status-label">Accept rate:&nbsp;</span>
            <span className="status-value">
              {doneCount > 0
                ? `${Math.round((acceptedImages.filter(i => i.status === 'accepted').length / doneCount) * 100)}%`
                : '—'}
            </span>
          </div>
        )}

        <div className="status-bar-spacer" />

        <div className="status-bar-right">
          <Icon icon="dot" size={12} />
          Drag &amp; drop supported
          <Divider />
          JPG · PNG · HEIC
          <Divider />
          <span
            suppressHydrationWarning
            style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.7 }}
            title={`Full session ID: ${sessionId}`}>
            Session&nbsp;<strong suppressHydrationWarning>{sessionId.slice(0, 8).toUpperCase()}</strong>
          </span>
        </div>
      </div>

      {/* =====================================================
          CONTENT AREA — SPLIT PANELS
          ===================================================== */}
      <div
        className="content-area"
        style={{ height: CONTENT_H, display: 'flex', overflow: 'hidden', flexShrink: 0 }}
      >
        {/* ==== ACCEPTED PANEL (Left) ==== */}
        <div
          className={`panel panel-accepted ${hasRejected ? 'split' : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            width: hasRejected ? `${leftWidthPct}%` : '100%',
            transition: isDraggingDivider ? 'none' : 'width 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="panel-header" style={{ height: PANEL_HDR_H, flexShrink: 0 }}>
            <div className="panel-header-left">
              <Icon icon="tick-circle" size={16} color="var(--intent-success)" />
              <span className="panel-section-label">Accepted</span>
              <span className={`panel-badge ${acceptedImages.filter(i => i.status === 'accepted').length > 0 ? 'success' : ''}`}>
                {acceptedImages.filter(i => i.status === 'accepted').length}
              </span>
              {processingCount > 0 && (
                <span className="panel-badge">
                  {processingCount} pending
                </span>
              )}
            </div>
            <div className="panel-header-right">
              <span className="criteria-bar">
                <span className="criteria-tag">JPG · PNG · HEIC</span>
                <span className="criteria-tag">≥ 256×256 px</span>
                <span className="criteria-tag">≥ 50 KB</span>
                <span className="criteria-tag">1 face · sharp · unique</span>
              </span>
            </div>
          </div>

          {totalCount === 0 ? (
            <div className="empty-state" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="empty-state-card">
                <div className="empty-state-icon-wrap">
                  <Icon icon="cloud-upload" size={40} />
                </div>
                <div className="empty-state-title">Upload &amp; Validate Images</div>
                <div className="empty-state-desc">
                  Drag and drop image files anywhere on screen or click below to select files from your computer.
                  <br />
                  <strong>Supported formats: JPG, PNG, HEIC</strong>
                </div>
                <Button
                  className="huge-browse-btn"
                  icon="folder-open"
                  intent="primary"
                  text="Browse Files"
                  onClick={openFilePicker}
                  large
                  style={{ padding: '12px 28px', fontSize: '16px' }}
                />
              </div>
            </div>
          ) : acceptedImages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <Icon icon="folder-open" size={30} color="var(--text-muted)" />
                <div style={{ marginTop: 12, fontSize: 14 }}>No accepted files</div>
              </div>
            </div>
          ) : (
            <div
              className="image-grid"
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', height: GRID_H }}
            >
              {acceptedImages.map((item) => (
                <ImageCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* ==== DRAGGABLE RESIZER ==== */}
        {hasRejected && (
          <div
            className={`panel-resizer ${isDraggingDivider ? 'active' : ''}`}
            onMouseDown={() => setIsDraggingDivider(true)}
          />
        )}

        {/* ==== REJECTED PANEL (Right) — slides in on first rejection ==== */}
        <div
          className={`panel panel-rejected ${hasRejected ? 'visible' : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            width: hasRejected ? `calc(${100 - leftWidthPct}% - 6px)` : '0%', // minus resizer width
            transition: isDraggingDivider ? 'none' : 'width 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="panel-header" style={{ height: PANEL_HDR_H, flexShrink: 0 }}>
            <div className="panel-header-left">
              <Icon icon="ban-circle" size={16} color="var(--intent-danger)" />
              <span className="panel-section-label">Rejected</span>
              <span className={`panel-badge ${rejectedImages.length > 0 ? 'danger' : ''}`}>
                {rejectedImages.length}
              </span>
            </div>
            <div className="panel-header-right">
              <span className="panel-hint">Review &amp; remediate</span>
            </div>
          </div>
          <div
            className="image-grid rejected-panel-grid"
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', height: GRID_H }}
          >
            {rejectedImages.map((item) => (
              <ImageCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================
          DRAG & DROP OVERLAY
          ===================================================== */}
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-box">
            <Icon icon="cloud-upload" size={48} />
            <div>Drop images to upload</div>
            <div className="drop-box-sub">JPG · PNG · HEIC supported</div>
          </div>
        </div>
      )}
    </div>
  );
}
