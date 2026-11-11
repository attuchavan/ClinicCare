import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/documents');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const documentController = {
  // List documents for a patient
  async getByPatient(req, res) {
    try {
      const { patientId } = req.params;
      const { category, showArchived = 'false' } = req.query;
      const clinicId = req.user.clinicId;

      const docs = await dbService.getCollection('medicalDocuments', clinicId);
      const filtered = docs.filter(d => {
        if (d.patientId !== patientId) return false;
        if (showArchived !== 'true' && d.isArchived) return false;
        if (category && d.category !== category) return false;
        return true;
      });

      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(filtered);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve patient documents' });
    }
  },

  // Get all previous prescriptions (both scanned/manual documents and clinic Rx) for check-in & consultation
  async getPreviousPrescriptions(req, res) {
    try {
      const { patientId } = req.params;
      const clinicId = req.user.clinicId;

      const [docs, rxList] = await Promise.all([
        dbService.getCollection('medicalDocuments', clinicId),
        dbService.getCollection('prescriptions', clinicId)
      ]);

      const previousDocs = docs.filter(d => 
        d.patientId === patientId && 
        !d.isArchived &&
        (d.category === 'Previous Prescription' || d.category === 'Handwritten Prescription' || d.isManualEntry)
      ).sort((a, b) => new Date(b.originalDocumentDate || b.createdAt) - new Date(a.originalDocumentDate || a.createdAt));

      const clinicRx = rxList.filter(r => 
        r.patientId === patientId
      ).sort((a, b) => new Date(b.prescriptionDate || b.createdAt) - new Date(a.prescriptionDate || a.createdAt));

      return res.json({
        documents: previousDocs,
        clinicPrescriptions: clinicRx,
        totalCount: previousDocs.length + clinicRx.length
      });
    } catch (err) {
      console.error('Error fetching previous prescriptions:', err);
      return res.status(500).json({ error: 'Failed to retrieve previous prescriptions' });
    }
  },

  // Upload new medical document (File, Base64 camera photo, or Manual Entry)
  async uploadDocument(req, res) {
    try {
      const {
        patientId,
        title,
        category = 'Previous Prescription',
        originalDocumentDate = new Date().toISOString().split('T')[0],
        notes = '',
        doctorName = '',
        prescribedMedicines = '',
        imageBase64 = '',
        imageData = '',
        isManualEntry = false
      } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' });
      }

      const clinicId = req.user.clinicId;
      const patient = await dbService.getDocument('patients', patientId);
      if (!patient || patient.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      let fileName = null;
      let originalName = null;
      let mimeType = 'text/plain';
      let fileSize = 0;
      let fileUrl = null;
      let isManual = Boolean(isManualEntry);

      // Scenario A: Standard file upload via multer
      if (req.file) {
        fileName = req.file.filename;
        originalName = req.file.originalname;
        mimeType = req.file.mimetype;
        fileSize = req.file.size;
        fileUrl = `/api/documents/file/${req.file.filename}`;
      } 
      // Scenario B: Mobile Camera Capture via Base64 payload
      else if (imageBase64 || imageData) {
        const rawData = imageBase64 || imageData;
        const matches = rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;
        let ext = '.jpg';
        mimeType = 'image/jpeg';

        if (matches && matches.length === 3) {
          mimeType = matches[1];
          ext = mimeType === 'image/png' ? '.png' : '.jpg';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(rawData, 'base64');
        }

        fileName = `cam-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        originalName = `Camera_Prescription_${originalDocumentDate}${ext}`;
        fileSize = buffer.length;
        fileUrl = `/api/documents/file/${fileName}`;

        const filePath = path.join(UPLOADS_DIR, fileName);
        fs.writeFileSync(filePath, buffer);
      } 
      // Scenario C: Manual Text Entry (No photo/document attached)
      else if (isManual || prescribedMedicines || doctorName) {
        isManual = true;
        originalName = 'Manual Prescription Entry';
      } else {
        return res.status(400).json({ error: 'Please attach a document file, take a camera photo, or enter prescription details manually.' });
      }

      const docRecord = await dbService.createDocument('medicalDocuments', {
        clinicId,
        patientId,
        patientName: patient.fullName,
        title: title || (isManual ? `Previous Rx - ${doctorName || 'Other Doctor'}` : originalName),
        category,
        originalDocumentDate,
        doctorName: doctorName || '',
        prescribedMedicines: prescribedMedicines || '',
        notes,
        fileName,
        originalName,
        mimeType,
        fileSize,
        fileUrl,
        isManualEntry: isManual,
        isArchived: false,
        uploadedBy: req.user.id,
        uploadedByName: req.user.name,
        uploadedByRole: req.user.role
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'DOCUMENT_UPLOAD',
        resourceType: 'medicalDocuments',
        resourceId: docRecord.id,
        details: { patientId, category, isManualEntry: isManual, fileName: fileName || 'manual-entry' }
      });

      return res.status(201).json(docRecord);
    } catch (err) {
      console.error('Document upload error:', err);
      return res.status(500).json({ error: 'Failed to upload medical document' });
    }
  },

  // Save manual text-only previous prescription record
  async saveManualPreviousPrescription(req, res) {
    try {
      const {
        patientId,
        doctorName,
        originalDocumentDate = new Date().toISOString().split('T')[0],
        prescribedMedicines,
        notes = '',
        title
      } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' });
      }
      if (!prescribedMedicines && !notes) {
        return res.status(400).json({ error: 'Prescribed medicines or clinical notes are required' });
      }

      const clinicId = req.user.clinicId;
      const patient = await dbService.getDocument('patients', patientId);
      if (!patient || patient.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const docRecord = await dbService.createDocument('medicalDocuments', {
        clinicId,
        patientId,
        patientName: patient.fullName,
        title: title || `Previous Rx - ${doctorName || 'External Doctor'}`,
        category: 'Previous Prescription',
        originalDocumentDate,
        doctorName: doctorName || 'External Doctor / Clinic',
        prescribedMedicines: prescribedMedicines || '',
        notes,
        fileName: null,
        originalName: 'Manual Prescription Entry',
        mimeType: 'text/plain',
        fileSize: 0,
        fileUrl: null,
        isManualEntry: true,
        isArchived: false,
        uploadedBy: req.user.id,
        uploadedByName: req.user.name,
        uploadedByRole: req.user.role
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'DOCUMENT_UPLOAD',
        resourceType: 'medicalDocuments',
        resourceId: docRecord.id,
        details: { patientId, category: 'Previous Prescription', isManualEntry: true }
      });

      return res.status(201).json(docRecord);
    } catch (err) {
      console.error('Manual prescription save error:', err);
      return res.status(500).json({ error: 'Failed to save manual previous prescription' });
    }
  },

  // Stream/Serve document file securely
  async getFile(req, res) {
    try {
      const { filename } = req.params;
      // Basic sanitization
      const safeFilename = path.basename(filename);
      const filePath = path.join(UPLOADS_DIR, safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document file not found' });
      }

      return res.sendFile(filePath);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to access document file' });
    }
  },

  // Archive document (Doctor only)
  async archiveDocument(req, res) {
    try {
      const { id } = req.params;
      const existing = await dbService.getDocument('medicalDocuments', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Medical document not found' });
      }

      const updated = await dbService.updateDocument('medicalDocuments', id, {
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: req.user.id
      });

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'DOCUMENT_ARCHIVE',
        resourceType: 'medicalDocuments',
        resourceId: id,
        details: { title: existing.title, patientId: existing.patientId }
      });

      return res.json({ message: 'Document archived successfully', document: updated });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to archive document' });
    }
  }
};

