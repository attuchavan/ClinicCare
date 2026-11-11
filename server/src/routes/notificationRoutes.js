import express from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { verifyAuth, requireClinic } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyAuth, requireClinic);

router.get('/', notificationController.listNotifications);
router.post('/send', notificationController.sendNotification);

export default router;

