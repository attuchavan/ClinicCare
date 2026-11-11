import express from 'express';
import { clinicController } from '../controllers/clinicController.js';
import { verifyAuth, requireRole } from '../middleware/authMiddleware.js';
import { validate, clinicValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Publicly readable clinic profile (e.g. for patient appointment booking page)
router.get('/', clinicController.getSettings);

// Doctor only can update clinic configuration
router.put('/', verifyAuth, requireRole('doctor'), validate(clinicValidationRules.update), clinicController.updateSettings);

export default router;

