import express from 'express';
import { consultationController } from '../controllers/consultationController.js';
import { verifyAuth, requireRole, requireClinic } from '../middleware/authMiddleware.js';
import { validate, consultationValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(verifyAuth, requireClinic, requireRole('doctor'));

router.get('/patient/:patientId', consultationController.getByPatient);
router.get('/:id', consultationController.getById);
router.post('/', validate(consultationValidationRules.create), consultationController.createConsultation);
router.put('/:id', validate(consultationValidationRules.update), consultationController.updateConsultation);

export default router;
