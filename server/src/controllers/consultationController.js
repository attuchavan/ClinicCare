import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

export const consultationController = {
  // Get all consultations for a patient
  async getByPatient(req, res) {
    try {
      const { patientId } = req.params;
      const clinicId = req.user.clinicId;
      const consultations = await dbService.getCollection('consultations', clinicId);
      const patientConsultations = consultations
        .filter(c => c.patientId === patientId)
        .sort((a, b) => new Date(b.consultationDate || b.createdAt) - new Date(a.consultationDate || a.createdAt));

      return res.json(patientConsultations);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve consultations' });
    }
  },

  // Get single consultation by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const consultation = await dbService.getDocument('consultations', id);
      if (!consultation || consultation.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Consultation record not found' });
      }
      return res.json(consultation);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve consultation details' });
    }
  },

  // Create new consultation (Doctor only)
  async createConsultation(req, res) {
    try {
      const {
        patientId,
        appointmentId,
        consultationDate = new Date().toISOString(),
        vitals = {}, // { bp: '120/80', pulse: '76', temp: '98.6', spo2: '98', weight: '68' }
        symptoms = '',
        examinationFindings = '',
        diagnosis = '',
        treatmentNotes = '',
        doctorAdvice = '',
        followUpDate = ''
      } = req.body;

      if (!patientId || !diagnosis) {
        return res.status(400).json({ error: 'Patient ID and Diagnosis are required' });
      }

      const clinicId = req.user.clinicId;
      const [patient, clinic] = await Promise.all([
        dbService.getDocument('patients', patientId),
        dbService.getDocument('clinicSettings', clinicId)
      ]);
      if (!patient || patient.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Patient record not found' });
      }

      const consultation = await dbService.createDocument('consultations', {
        clinicId,
        patientId,
        patientName: patient.fullName,
        patientPhone: patient.mobileNumber,
        appointmentId: appointmentId || null,
        consultationDate,
        vitals: {
          bp: vitals.bp || '',
          pulse: vitals.pulse || '',
          temp: vitals.temp || '',
          spo2: vitals.spo2 || '',
          weight: vitals.weight || ''
        },
        symptoms,
        examinationFindings,
        diagnosis,
        treatmentNotes,
        doctorAdvice,
        followUpDate: followUpDate || '',
        doctorId: req.user.id,
        doctorName: clinic?.doctorName || req.user.name
      });

      // If tied to an appointment, transition appointment to 'completed'
      if (appointmentId) {
        try {
          await dbService.updateDocument('appointments', appointmentId, {
            status: 'completed',
            consultationId: consultation.id
          });
        } catch (appErr) {
          console.warn('Could not update appointment status:', appErr.message);
        }
      }

      // If follow-up date specified, create follow-up record
      if (followUpDate) {
        try {
          await dbService.createDocument('followUps', {
            clinicId,
            patientId,
            patientName: patient.fullName,
            patientPhone: patient.mobileNumber,
            consultationId: consultation.id,
            diagnosis,
            followUpDate,
            status: 'scheduled',
            notes: `Follow-up for ${diagnosis}`
          });
        } catch (fErr) {
          console.warn('Could not auto-create follow-up:', fErr.message);
        }
      }

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'CONSULTATION_CREATE',
        resourceType: 'consultations',
        resourceId: consultation.id,
        details: { patientId, diagnosis }
      });

      return res.status(201).json(consultation);
    } catch (err) {
      console.error('Consultation creation error:', err);
      return res.status(500).json({ error: 'Failed to record consultation' });
    }
  },

  // Update consultation (Doctor only)
  async updateConsultation(req, res) {
    try {
      const { id } = req.params;
      const existing = await dbService.getDocument('consultations', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Consultation record not found' });
      }

      const {
        vitals,
        symptoms,
        examinationFindings,
        diagnosis,
        treatmentNotes,
        doctorAdvice,
        followUpDate
      } = req.body;

      const updates = {
        vitals: vitals !== undefined ? vitals : existing.vitals,
        symptoms: symptoms !== undefined ? symptoms : existing.symptoms,
        examinationFindings: examinationFindings !== undefined ? examinationFindings : existing.examinationFindings,
        diagnosis: diagnosis !== undefined ? diagnosis : existing.diagnosis,
        treatmentNotes: treatmentNotes !== undefined ? treatmentNotes : existing.treatmentNotes,
        doctorAdvice: doctorAdvice !== undefined ? doctorAdvice : existing.doctorAdvice,
        followUpDate: followUpDate !== undefined ? followUpDate : existing.followUpDate,
        updatedBy: req.user.id
      };

      const updated = await dbService.updateDocument('consultations', id, updates);

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'CONSULTATION_UPDATE',
        resourceType: 'consultations',
        resourceId: id,
        details: { diagnosis: updated.diagnosis }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update consultation' });
    }
  }
};

