import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

import { getNextSequenceCode } from '../utils/helpers.js';

const generateRxNumber = async (clinicId) => {
  const currentYear = new Date().getFullYear();
  const prescriptions = await dbService.getCollection('prescriptions', clinicId);
  return getNextSequenceCode(prescriptions, 'rxNumber', `RX-${currentYear}-`, 5);
};

export const prescriptionController = {
  // Get prescriptions for a patient
  async getByPatient(req, res) {
    try {
      const { patientId } = req.params;
      const clinicId = req.user.clinicId;
      const prescriptions = await dbService.getCollection('prescriptions', clinicId);
      const filtered = prescriptions
        .filter(p => p.patientId === patientId)
        .sort((a, b) => new Date(b.prescriptionDate || b.createdAt) - new Date(a.prescriptionDate || a.createdAt));

      return res.json(filtered);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve prescriptions' });
    }
  },

  // Get prescription by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const rx = await dbService.getDocument('prescriptions', id);
      if (!rx || rx.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Prescription not found' });
      }
      return res.json(rx);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve prescription' });
    }
  },

  // Create digital prescription (Doctor only)
  async createPrescription(req, res) {
    try {
      const {
        patientId,
        consultationId,
        diagnosis = '',
        medicines = [],
        generalAdvice = '',
        dietaryAdvice = '',
        followUpDate = '',
        status = 'approved' // 'draft' | 'approved'
      } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' });
      }

      if (!Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({ error: 'At least one medicine is required to generate a prescription' });
      }

      const clinicId = req.user.clinicId;
      const patient = await dbService.getDocument('patients', patientId);
      if (!patient || patient.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const clinic = await dbService.getDocument('clinicSettings', clinicId);
      const rxNumber = await generateRxNumber(clinicId);

      const prescription = await dbService.createDocument('prescriptions', {
        clinicId,
        rxNumber,
        patientId,
        patientName: patient.fullName,
        patientIdCode: patient.patientId,
        patientAge: patient.dateOfBirth ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null,
        patientGender: patient.gender,
        patientPhone: patient.mobileNumber,
        consultationId: consultationId || null,
        diagnosis,
        medicines: medicines.map(m => ({
          name: m.name || '',
          strength: m.strength || '',
          dosage: m.dosage || '',
          route: m.route || 'Oral',
          frequency: m.frequency || '1-0-1',
          duration: m.duration || '5 days',
          quantity: m.quantity || '',
          instructions: m.instructions || 'After food'
        })),
        generalAdvice,
        dietaryAdvice,
        followUpDate,
        status, // 'draft' or 'approved'
        doctorDetails: {
          id: req.user.id,
          name: req.user.name,
          qualification: clinic?.doctorName || 'M.D. (Medicine)',
          regNo: clinic?.doctorRegNo || 'MCI Registered'
        },
        clinicDetails: {
          name: clinic?.name || 'ClinicCare Family Clinic',
          address: clinic?.address || '',
          phone: clinic?.phone || ''
        },
        prescriptionDate: new Date().toISOString(),
        version: 1,
        revisionHistory: []
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'PRESCRIPTION_CREATE',
        resourceType: 'prescriptions',
        resourceId: prescription.id,
        details: { rxNumber, patientId, medicineCount: medicines.length, status }
      });

      return res.status(201).json(prescription);
    } catch (err) {
      console.error('Prescription creation error:', err);
      return res.status(500).json({ error: 'Failed to create digital prescription' });
    }
  },

  // Update prescription with version preservation (Doctor only)
  async updatePrescription(req, res) {
    try {
      const { id } = req.params;
      const existing = await dbService.getDocument('prescriptions', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      const {
        diagnosis,
        medicines,
        generalAdvice,
        dietaryAdvice,
        followUpDate,
        status = 'approved',
        reasonForCorrection = 'Doctor revision'
      } = req.body;

      // Preserve previous version in revision history
      const previousSnapshot = {
        version: existing.version || 1,
        medicines: existing.medicines,
        diagnosis: existing.diagnosis,
        generalAdvice: existing.generalAdvice,
        modifiedAt: new Date().toISOString(),
        modifiedBy: req.user.name,
        reason: reasonForCorrection
      };

      const revisionHistory = Array.isArray(existing.revisionHistory) 
        ? [...existing.revisionHistory, previousSnapshot] 
        : [previousSnapshot];

      const updates = {
        diagnosis: diagnosis !== undefined ? diagnosis : existing.diagnosis,
        medicines: medicines !== undefined ? medicines : existing.medicines,
        generalAdvice: generalAdvice !== undefined ? generalAdvice : existing.generalAdvice,
        dietaryAdvice: dietaryAdvice !== undefined ? dietaryAdvice : existing.dietaryAdvice,
        followUpDate: followUpDate !== undefined ? followUpDate : existing.followUpDate,
        status: status !== undefined ? status : existing.status,
        version: (existing.version || 1) + 1,
        revisionHistory,
        lastCorrectedAt: new Date().toISOString(),
        lastCorrectedBy: req.user.name
      };

      const updated = await dbService.updateDocument('prescriptions', id, updates);

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'PRESCRIPTION_REVISED',
        resourceType: 'prescriptions',
        resourceId: id,
        details: { rxNumber: existing.rxNumber, newVersion: updates.version, reason: reasonForCorrection }
      });

      return res.json(updated);
    } catch (err) {
      console.error('Update prescription error:', err);
      return res.status(500).json({ error: 'Failed to update prescription' });
    }
  }
};

