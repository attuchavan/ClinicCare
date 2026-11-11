import express from 'express';
import { authController } from '../controllers/authController.js';
import { verifyAuth, requireRole, requireClinic } from '../middleware/authMiddleware.js';
import { validate, authValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.post('/login', validate(authValidationRules.login), authController.login);
router.post('/reset-password', validate(authValidationRules.resetPassword), authController.requestPasswordReset);
router.get('/me', verifyAuth, authController.getMe);
router.get('/staff', verifyAuth, requireClinic, requireRole('doctor'), authController.listStaff);
router.post('/staff', verifyAuth, requireClinic, requireRole('doctor'), validate(authValidationRules.createStaff), authController.createStaff);
router.patch('/staff/:id/status', verifyAuth, requireClinic, requireRole('doctor'), validate(authValidationRules.toggleStatus), authController.toggleStaffStatus);

export default router;
