import { dbService } from '../services/db.js';

export const logAudit = async ({
  clinicId = 'clinic-default',
  actorId,
  actorName = 'System',
  actorRole = 'system',
  action,
  resourceType,
  resourceId,
  details = {},
  ipAddress = ''
}) => {
  try {
    const entry = {
      clinicId,
      actorId: actorId || 'system',
      actorName,
      actorRole,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      timestamp: new Date().toISOString()
    };
    await dbService.createDocument('auditLogs', entry);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
};

