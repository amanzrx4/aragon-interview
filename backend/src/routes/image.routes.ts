import { Router } from 'express';
import multer from 'multer';
import { uploadImage, getImages, getImage, deleteImage } from '../controllers/image.controller';

const router = Router();

// Store in memory — file is validated then uploaded to Uploadthing (no local disk needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB hard cap
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      // Still let it through — validation service will reject it with a friendly message
      cb(null, true);
    }
  },
});

// POST   /api/images/upload
router.post('/upload', upload.single('image'), uploadImage);

// GET    /api/images
router.get('/', getImages);

// GET    /api/images/:id
router.get('/:id', getImage);

// DELETE /api/images/:id
router.delete('/:id', deleteImage);

export default router;
