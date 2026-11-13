import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

export const clinicController = {
  // Get clinic profile and settings
  async getSettings(req, res) {
    try {
      const clinicId = req.user ? req.user.clinicId : (req.query.clinicId || 'clinic-default');
      const clinic = await dbService.getDocument('clinicSettings', clinicId);
      if (!clinic) {
        return res.status(404).json({ error: 'Clinic settings not found' });
      }
      return res.json(clinic);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve clinic settings' });
    }
  },

  // Update clinic settings (Doctor only)
  async updateSettings(req, res) {
    try {
      const clinicId = req.user.clinicId;
      const {
        name,
        tagline,
        doctorName,
        doctorRegNo,
        phone,
        email,
        address,
        consultationFee, // In paise
        followUpValidityDays,
        workingHours,
        slotDurationMinutes
      } = req.body;

      const existing = await dbService.getDocument('clinicSettings', clinicId);
      if (!existing) {
        return res.status(404).json({ error: 'Clinic settings not found' });
      }

      const updates = {
        name: name !== undefined ? name : existing.name,
        tagline: tagline !== undefined ? tagline : existing.tagline,
        doctorName: doctorName !== undefined ? doctorName : existing.doctorName,
        doctorRegNo: doctorRegNo !== undefined ? doctorRegNo : existing.doctorRegNo,
        phone: phone !== undefined ? phone : existing.phone,
        email: email !== undefined ? email : existing.email,
        address: address !== undefined ? address : existing.address,
        consultationFee: consultationFee !== undefined ? Number(consultationFee) : existing.consultationFee,
        followUpValidityDays: followUpValidityDays !== undefined ? Number(followUpValidityDays) : existing.followUpValidityDays,
        workingHours: workingHours !== undefined ? workingHours : existing.workingHours,
        slotDurationMinutes: slotDurationMinutes !== undefined ? Number(slotDurationMinutes) : existing.slotDurationMinutes,
        updatedBy: req.user.id
      };

      const updated = await dbService.updateDocument('clinicSettings', clinicId, updates);

      // Synchronize doctor user profile in users collection so req.user.name and auth endpoints immediately reflect the doctor's name and phone
      let updatedUser = null;
      if (req.user && req.user.role === 'doctor') {
        const userUpdates = {};
        if (doctorName && doctorName.trim()) {
          userUpdates.name = doctorName.trim();
        }
        if (phone && phone.trim()) {
          userUpdates.phone = phone.trim();
        }
        if (email && email.trim()) {
          userUpdates.email = email.trim();
        }
        if (Object.keys(userUpdates).length > 0) {
          try {
            updatedUser = await dbService.updateDocument('users', req.user.id, userUpdates);
            req.user.name = userUpdates.name || req.user.name;
          } catch (uErr) {
            console.warn('Could not sync user profile with clinic settings:', uErr.message);
          }
        }
      }

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: updated.doctorName || req.user.name,
        actorRole: req.user.role,
        action: 'CLINIC_SETTINGS_UPDATE',
        resourceType: 'clinicSettings',
        resourceId: clinicId,
        details: { name: updated.name, doctorName: updated.doctorName, address: updated.address }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update clinic configuration' });
    }
  }
};

