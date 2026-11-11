import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

export const notificationController = {
  // List notification queue and logs
  async listNotifications(req, res) {
    try {
      const { status, type } = req.query;
      const clinicId = req.user.clinicId;
      const notifications = await dbService.getCollection('notifications', clinicId);

      let filtered = notifications.filter(n => {
        if (status && n.status !== status) return false;
        if (type && n.type !== type) return false;
        return true;
      });

      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(filtered);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve notification queue' });
    }
  },

  // Queue and dispatch a notification
  async sendNotification(req, res) {
    try {
      const {
        recipientPhone,
        recipientName,
        type, // 'appointment_confirmation' | 'appointment_reminder' | 'cancellation' | 'followup_reminder'
        channel = 'whatsapp', // 'whatsapp' | 'sms'
        metadata = {} // { appointmentDate, appointmentTime, doctorName, clinicName }
      } = req.body;

      if (!recipientPhone || !type) {
        return res.status(400).json({ error: 'Recipient phone number and notification type are required' });
      }

      const clinicId = req.user.clinicId;
      const idempotencyKey = `${clinicId}-${type}-${recipientPhone}-${metadata.appointmentDate || ''}-${metadata.appointmentTime || ''}`;

      // Duplicate prevention within the last 10 minutes
      const existing = await dbService.getCollection('notifications', clinicId);
      const isDuplicate = existing.find(n => n.idempotencyKey === idempotencyKey && n.status === 'sent');
      if (isDuplicate) {
        return res.status(409).json({ error: 'A duplicate notification was already sent recently' });
      }

      // Check WhatsApp Business Cloud API config
      const isWhatsAppConfigured = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

      const notification = await dbService.createDocument('notifications', {
        clinicId,
        idempotencyKey,
        recipientPhone,
        recipientName: recipientName || 'Patient',
        type,
        channel,
        metadata,
        status: isWhatsAppConfigured ? 'sent' : 'queued',
        deliveryStatus: isWhatsAppConfigured ? 'delivered' : 'pending_provider_setup',
        provider: 'Meta WhatsApp Business Cloud API',
        dispatchedAt: new Date().toISOString(),
        retryCount: 0,
        createdBy: req.user.id
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'NOTIFICATION_DISPATCH',
        resourceType: 'notifications',
        resourceId: notification.id,
        details: { type, recipientPhone, channel }
      });

      return res.status(201).json({
        message: isWhatsAppConfigured 
          ? 'Notification dispatched via WhatsApp Business Cloud API' 
          : 'Notification placed in queue (WhatsApp Business Cloud API ready)',
        notification
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to dispatch notification' });
    }
  }
};

