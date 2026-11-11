import express from 'express';
import { prescriptionController } from '../controllers/prescriptionController.js';
import { verifyAuth, requireRole, requireClinic } from '../middleware/authMiddleware.js';
import { validate, prescriptionValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(verifyAuth, requireClinic);

// Doctor & Receptionist can view prescriptions (e.g. for printing for patient)
router.get('/patient/:patientId', prescriptionController.getByPatient);
router.get('/:id', prescriptionController.getById);

// Doctor only can create and update prescriptions
router.post('/', requireRole('doctor'), validate(prescriptionValidationRules.create), prescriptionController.createPrescription);
router.put('/:id', requireRole('doctor'), validate(prescriptionValidationRules.update), prescriptionController.updatePrescription);

export default router;
