import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { documentController } from '../controllers/documentController.js';
import { verifyAuth, requireRole, requireClinic } from '../middleware/authMiddleware.js';
import { validate, documentValidationRules } from '../middleware/validationMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/documents');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

// File filter (JPG, JPEG, PNG, PDF max 15MB)
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG and PDF documents are supported.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter
});

const router = express.Router();

// Public/Authorized file viewing route
router.get('/file/:filename', documentController.getFile);

// Protected routes
router.use(verifyAuth, requireClinic);
router.get('/patient/:patientId', documentController.getByPatient);
router.get('/patient/:patientId/previous-prescriptions', documentController.getPreviousPrescriptions);
router.post('/upload', upload.single('document'), documentController.uploadDocument);
router.post('/manual-prescription', validate(documentValidationRules.manualPrescription), documentController.saveManualPreviousPrescription);
router.delete('/:id', requireRole('doctor'), documentController.archiveDocument);

export default router;

