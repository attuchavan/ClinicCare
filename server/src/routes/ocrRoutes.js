import express from 'express';
import { ocrController } from '../controllers/ocrController.js';
import { verifyAuth, requireRole, requireClinic } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyAuth, requireClinic);

router.post('/transcribe', ocrController.transcribeDocument);
router.post('/verify', requireRole('doctor'), ocrController.saveVerifiedTranscription);

export default router;

