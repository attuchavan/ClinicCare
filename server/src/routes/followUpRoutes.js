import express from 'express';
import { followUpController } from '../controllers/followUpController.js';
import { verifyAuth, requireClinic } from '../middleware/authMiddleware.js';
import { validate, followUpValidationRules } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(verifyAuth, requireClinic);

router.get('/', followUpController.listFollowUps);
router.patch('/:id/status', validate(followUpValidationRules.updateStatus), followUpController.updateStatus);

export default router;

