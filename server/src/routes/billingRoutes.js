import express from 'express';
import { billingController } from '../controllers/billingController.js';
import { verifyAuth, requireRole, requireClinic } from '../middleware/authMiddleware.js';
import { validate, billingValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(verifyAuth, requireClinic);

// Doctor & Receptionist can list bills, view by id, create bills, record payments
router.get('/', billingController.listBills);
router.get('/reports', requireRole('doctor'), billingController.getReports);
router.get('/:id', billingController.getById);
router.post('/', validate(billingValidationRules.create), billingController.createBill);
router.patch('/:id/payment', validate(billingValidationRules.recordPayment), billingController.recordPayment);

export default router;
