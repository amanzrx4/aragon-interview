import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import imageRoutes from './routes/image.routes';
import { preloadFaceModel } from './services/face.service';
import sharp from 'sharp';

dotenv.config();

// Extremely aggressive memory saving for free-tier Render instances
sharp.cache(false); // Disable libvips caching so image buffers are freed immediately
sharp.concurrency(1); // Process images one thread at a time to avoid memory spikes

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  exposedHeaders: ['X-Session-Id'],
}));
app.use(express.json());

// ── REST API ──────────────────────────────────────────────────────────────────
app.use('/api/images', imageRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aragon-backend' });
});

// ── Debug: inspect in-memory session hash sets ────────────────────────────────
import { getSessionDebugInfo, clearAllSessions } from './services/validation.service';

app.get('/api/debug/sessions', (_req, res) => {
  res.json(getSessionDebugInfo());
});

app.post('/api/debug/clear', (_req, res) => {
  clearAllSessions();
  res.json({ cleared: true });
});

// ── Start server + preload face detection model in background ─────────────────
app.listen(port, () => {
  console.log(`[server] Running at http://localhost:${port}`);
  // Preload model immediately so the first real request doesn't pay the cold-start cost.
  preloadFaceModel().catch(() => {
    console.error('[server] Face model preload failed — face checks will reject images.');
  });
});
