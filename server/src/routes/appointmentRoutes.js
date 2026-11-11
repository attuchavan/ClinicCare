import express from 'express';
import { appointmentController } from '../controllers/appointmentController.js';
import { verifyAuth, requireClinic } from '../middleware/authMiddleware.js';
import { validate, appointmentValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/slots', appointmentController.getSlots);
router.post('/public', validate(appointmentValidationRules.publicBooking), appointmentController.publicBooking);

// Protected routes (Doctor / Receptionist)
router.use(verifyAuth, requireClinic);
router.get('/', appointmentController.listAppointments);
router.post('/', validate(appointmentValidationRules.create), appointmentController.bookAppointment);
router.patch('/:id/status', validate(appointmentValidationRules.status), appointmentController.updateStatus);
router.put('/:id/reschedule', validate(appointmentValidationRules.reschedule), appointmentController.reschedule);
router.delete('/:id', appointmentController.cancelAppointment);

export default router;
