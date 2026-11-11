import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

export const followUpController = {
  // List follow-ups with filters: due, upcoming, overdue, completed
  async listFollowUps(req, res) {
    try {
      const { filter = 'all', patientId } = req.query;
      const clinicId = req.user.clinicId;
      const followUps = await dbService.getCollection('followUps', clinicId);

      const todayStr = new Date().toISOString().slice(0, 10);

      let filtered = followUps.filter(f => {
        if (patientId && f.patientId !== patientId) return false;

        if (filter === 'due_today') {
          return f.followUpDate === todayStr && f.status !== 'completed' && f.status !== 'cancelled';
        }
        if (filter === 'overdue') {
          return f.followUpDate < todayStr && f.status !== 'completed' && f.status !== 'cancelled';
        }
        if (filter === 'upcoming') {
          return f.followUpDate >= todayStr && f.status !== 'completed' && f.status !== 'cancelled';
        }
        if (filter === 'completed') {
          return f.status === 'completed';
        }
        return true;
      });

      // Sort by followUpDate ascending
      filtered.sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''));

      return res.json({
        total: filtered.length,
        dueTodayCount: followUps.filter(f => f.followUpDate === todayStr && f.status !== 'completed' && f.status !== 'cancelled').length,
        overdueCount: followUps.filter(f => f.followUpDate < todayStr && f.status !== 'completed' && f.status !== 'cancelled').length,
        upcomingCount: followUps.filter(f => f.followUpDate >= todayStr && f.status !== 'completed' && f.status !== 'cancelled').length,
        followUps: filtered
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve follow-ups' });
    }
  },

  // Mark follow-up status (e.g. completed, cancelled)
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const validStatuses = ['scheduled', 'reminder_sent', 'completed', 'cancelled'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const existing = await dbService.getDocument('followUps', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Follow-up not found' });
      }

      const updated = await dbService.updateDocument('followUps', id, {
        status,
        notes: notes !== undefined ? notes : existing.notes,
        updatedBy: req.user.id
      });

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'FOLLOWUP_STATUS_UPDATE',
        resourceType: 'followUps',
        resourceId: id,
        details: { previousStatus: existing.status, newStatus: status }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update follow-up status' });
    }
  }
};

