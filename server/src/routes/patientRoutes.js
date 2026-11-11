import express from 'express';
import { patientController } from '../controllers/patientController.js';
import { verifyAuth, requireRole, requireClinic } from '../middleware/authMiddleware.js';
import { validate, patientValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(verifyAuth, requireClinic);

router.get('/', patientController.listPatients);
router.get('/check-duplicate', patientController.checkDuplicate);
router.get('/:id', patientController.getPatient);
router.get('/:id/timeline', patientController.getPatientTimeline);
router.post('/', validate(patientValidationRules.create), patientController.registerPatient);
router.put('/:id', validate(patientValidationRules.update), patientController.updatePatient);
router.delete('/:id', requireRole('doctor'), patientController.archivePatient);

export default router;
