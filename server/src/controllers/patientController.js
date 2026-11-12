import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

import { getNextSequenceCode } from '../utils/helpers.js';

// Helper to generate next sequential Patient ID: CC-YYYY-XXXX
const generatePatientId = async (clinicId) => {
  const currentYear = new Date().getFullYear();
  const patients = await dbService.getCollection('patients', clinicId);
  return getNextSequenceCode(patients, 'patientId', `CC-${currentYear}-`, 4);
};

export const patientController = {
  // List and search patients
  async listPatients(req, res) {
    try {
      const { search = '', bloodGroup, gender, showArchived = 'false', page = 1, limit = 50 } = req.query;
      const clinicId = req.user.clinicId;
      const patients = await dbService.getCollection('patients', clinicId);

      let filtered = patients.filter(p => {
        if (showArchived !== 'true' && p.isArchived) return false;
        if (bloodGroup && p.bloodGroup !== bloodGroup) return false;
        if (gender && p.gender !== gender) return false;

        if (search) {
          const q = search.toLowerCase().trim();
          const matchName = (p.fullName || '').toLowerCase().includes(q);
          const matchPhone = (p.mobileNumber || '').includes(q);
          const matchId = (p.patientId || '').toLowerCase().includes(q);
          return matchName || matchPhone || matchId;
        }
        return true;
      });

      // Sort by newest first
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = filtered.length;
      const startIndex = (Number(page) - 1) * Number(limit);
      const paginated = filtered.slice(startIndex, startIndex + Number(limit));

      return res.json({
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        patients: paginated
      });
    } catch (err) {
      console.error('List patients error:', err);
      return res.status(500).json({ error: 'Failed to fetch patients list' });
    }
  },

  // Check for duplicate patient by phone and name
  async checkDuplicate(req, res) {
    try {
      const { mobileNumber, fullName } = req.query;
      if (!mobileNumber && !fullName) {
        return res.json({ hasDuplicate: false, duplicates: [] });
      }

      const clinicId = req.user.clinicId;
      const patients = await dbService.getCollection('patients', clinicId);

      const duplicates = patients.filter(p => {
        if (p.isArchived) return false;
        const phoneMatch = mobileNumber && p.mobileNumber && p.mobileNumber.replace(/\D/g, '') === mobileNumber.replace(/\D/g, '');
        const nameMatch = fullName && (p.fullName || '').toLowerCase().trim() === fullName.toLowerCase().trim();
        return phoneMatch || nameMatch;
      });

      return res.json({
        hasDuplicate: duplicates.length > 0,
        duplicates: duplicates.map(d => ({
          id: d.id,
          patientId: d.patientId,
          fullName: d.fullName,
          mobileNumber: d.mobileNumber,
          dateOfBirth: d.dateOfBirth,
          gender: d.gender
        }))
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to verify duplicate patients' });
    }
  },

  // Get single patient profile
  async getPatient(req, res) {
    try {
      const { id } = req.params;
      const patient = await dbService.getDocument('patients', id);
      if (!patient || patient.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      return res.json(patient);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve patient profile' });
    }
  },

  // Register new patient
  async registerPatient(req, res) {
    try {
      const {
        fullName,
        dateOfBirth,
        gender,
        mobileNumber,
        address,
        emergencyContact,
        bloodGroup,
        allergies,
        medicalHistory
      } = req.body;

      if (!fullName || !mobileNumber || !gender) {
        return res.status(400).json({ error: 'Full name, mobile number, and gender are required' });
      }

      const clinicId = req.user.clinicId;
      const patientId = await generatePatientId(clinicId);

      const newPatient = await dbService.createDocument('patients', {
        clinicId,
        patientId,
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || '',
        gender,
        mobileNumber: mobileNumber.trim(),
        address: address || '',
        emergencyContact: emergencyContact || '',
        bloodGroup: bloodGroup || '',
        allergies: allergies || '',
        medicalHistory: medicalHistory || '',
        isArchived: false,
        createdBy: req.user.id,
        createdByName: req.user.name,
        createdByRole: req.user.role
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'PATIENT_REGISTER',
        resourceType: 'patients',
        resourceId: newPatient.id,
        details: { patientId, fullName, mobileNumber }
      });

      return res.status(201).json(newPatient);
    } catch (err) {
      console.error('Patient registration error:', err);
      return res.status(500).json({ error: 'Failed to register patient' });
    }
  },

  // Update patient demographics
  async updatePatient(req, res) {
    try {
      const { id } = req.params;
      const existing = await dbService.getDocument('patients', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const {
        fullName,
        dateOfBirth,
        gender,
        mobileNumber,
        address,
        emergencyContact,
        bloodGroup,
        allergies,
        medicalHistory
      } = req.body;

      // Allow updates to authorized demographics
      const updates = {
        fullName: fullName !== undefined ? fullName.trim() : existing.fullName,
        dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : existing.dateOfBirth,
        gender: gender !== undefined ? gender : existing.gender,
        mobileNumber: mobileNumber !== undefined ? mobileNumber.trim() : existing.mobileNumber,
        address: address !== undefined ? address : existing.address,
        emergencyContact: emergencyContact !== undefined ? emergencyContact : existing.emergencyContact,
        bloodGroup: bloodGroup !== undefined ? bloodGroup : existing.bloodGroup,
        allergies: allergies !== undefined ? allergies : existing.allergies,
        medicalHistory: medicalHistory !== undefined ? medicalHistory : existing.medicalHistory,
        updatedBy: req.user.id
      };

      const updated = await dbService.updateDocument('patients', id, updates);

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'PATIENT_UPDATE',
        resourceType: 'patients',
        resourceId: id,
        details: { patientId: existing.patientId }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update patient details' });
    }
  },

  // Archive patient (Doctor only - preserve medical history)
  async archivePatient(req, res) {
    try {
      const { id } = req.params;
      const existing = await dbService.getDocument('patients', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const updated = await dbService.updateDocument('patients', id, {
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: req.user.id
      });

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'PATIENT_ARCHIVE',
        resourceType: 'patients',
        resourceId: id,
        details: { patientId: existing.patientId }
      });

      return res.json({ message: 'Patient record archived successfully', patient: updated });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to archive patient' });
    }
  },

  // Chronological Medical Timeline (Module 7)
  async getPatientTimeline(req, res) {
    try {
      const { id } = req.params;
      const { filter = 'all' } = req.query; // all, consultations, prescriptions, documents, appointments, bills
      const clinicId = req.user.clinicId;

      const patient = await dbService.getDocument('patients', id);
      if (!patient || patient.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const timelineEvents = [];

      // 1. Patient Registration Event
      if (filter === 'all') {
        timelineEvents.push({
          type: 'registration',
          id: `reg-${patient.id}`,
          title: 'Patient Registered',
          date: patient.createdAt,
          description: `Registered with Patient ID: ${patient.patientId}`,
          data: {
            createdByName: patient.createdByName,
            bloodGroup: patient.bloodGroup,
            allergies: patient.allergies
          }
        });
      }

      // 2. Consultations
      if (filter === 'all' || filter === 'consultations') {
        const consultations = await dbService.getCollection('consultations', clinicId);
        const patientConsultations = consultations.filter(c => c.patientId === id);
        patientConsultations.forEach(c => {
          timelineEvents.push({
            type: 'consultation',
            id: c.id,
            title: `Consultation: ${c.diagnosis || 'General Checkup'}`,
            date: c.consultationDate || c.createdAt,
            description: c.symptoms ? `Symptoms: ${c.symptoms}` : 'Routine clinical examination',
            data: c
          });
        });
      }

      // 3. Prescriptions
      if (filter === 'all' || filter === 'prescriptions') {
        const prescriptions = await dbService.getCollection('prescriptions', clinicId);
        const patientPrescriptions = prescriptions.filter(p => p.patientId === id);
        patientPrescriptions.forEach(p => {
          timelineEvents.push({
            type: 'prescription',
            id: p.id,
            title: `Prescription #${p.rxNumber || p.id.slice(0, 8)}`,
            date: p.prescriptionDate || p.createdAt,
            description: `${(p.medicines || []).length} medicines prescribed. Status: ${p.status || 'Approved'}`,
            data: p
          });
        });
      }

      // 4. Medical Documents
      if (filter === 'all' || filter === 'documents' || filter === 'reports') {
        const documents = await dbService.getCollection('medicalDocuments', clinicId);
        const patientDocs = documents.filter(d => d.patientId === id && !d.isArchived);
        patientDocs.forEach(d => {
          timelineEvents.push({
            type: 'document',
            id: d.id,
            title: `Document: ${d.title || d.category || 'Medical Report'}`,
            date: d.originalDocumentDate || d.createdAt,
            description: `Category: ${d.category}. Uploaded by ${d.uploadedByName || 'Staff'}`,
            data: d
          });
        });
      }

      // 5. Follow-ups
      if (filter === 'all') {
        const followUps = await dbService.getCollection('followUps', clinicId);
        const patientFollowUps = followUps.filter(f => f.patientId === id);
        patientFollowUps.forEach(f => {
          timelineEvents.push({
            type: 'followup',
            id: f.id,
            title: `Follow-up Visit`,
            date: f.followUpDate,
            description: `Status: ${f.status}. Notes: ${f.notes || 'Routine follow-up'}`,
            data: f
          });
        });
      }

      // 6. Bills
      if (filter === 'all' || filter === 'bills') {
        const bills = await dbService.getCollection('bills', clinicId);
        const patientBills = bills.filter(b => b.patientId === id);
        patientBills.forEach(b => {
          timelineEvents.push({
            type: 'bill',
            id: b.id,
            title: `Receipt #${b.receiptNumber}`,
            date: b.createdAt,
            description: `Total: ₹${(b.totalAmount / 100).toFixed(2)} | Paid: ₹${(b.paidAmount / 100).toFixed(2)} (${b.paymentMethod})`,
            data: b
          });
        });
      }

      // Sort timeline events chronologically descending (newest first)
      timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

      return res.json({
        patient: {
          id: patient.id,
          patientId: patient.patientId,
          fullName: patient.fullName,
          age: patient.dateOfBirth ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          allergies: patient.allergies,
          medicalHistory: patient.medicalHistory
        },
        timeline: timelineEvents
      });
    } catch (err) {
      console.error('Timeline error:', err);
      return res.status(500).json({ error: 'Failed to assemble patient medical timeline' });
    }
  }
};

