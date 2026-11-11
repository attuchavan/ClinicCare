import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

export const ocrController = {
  // Transcribe medical document / handwritten prescription
  async transcribeDocument(req, res) {
    try {
      const { documentId, customText } = req.body;
      const clinicId = req.user.clinicId;

      if (documentId && documentId !== 'test-doc') {
        const document = await dbService.getDocument('medicalDocuments', documentId);
        if (document && document.clinicId !== clinicId) {
          return res.status(403).json({ error: 'Access denied to document from another clinic' });
        }
      }

      // Simulated OCR extraction engine (extensible with Tesseract or Google Cloud Vision)
      // Extracts text blocks with confidence scores and candidate medicine lines
      const simulatedRawText = customText || [
        "Rx:",
        "1. Tab Paracetamol 650mg - 1 Tab TDS x 3 days (after food)",
        "2. Cap Amoxicillin 500mg - 1 Cap BD x 5 days",
        "3. Tab Cetirizine 10mg - 1 Tab HS x 5 days",
        "Advice: Steam inhalation twice daily, drink warm water.",
        "Follow up in 5 days if fever persists."
      ].join('\n');

      const parsedCandidateMedicines = [
        { name: 'Paracetamol', strength: '650mg', dosage: '1 Tab', frequency: 'TDS (1-1-1)', duration: '3 days', instructions: 'After food' },
        { name: 'Amoxicillin', strength: '500mg', dosage: '1 Cap', frequency: 'BD (1-0-1)', duration: '5 days', instructions: 'After food' },
        { name: 'Cetirizine', strength: '10mg', dosage: '1 Tab', frequency: 'HS (0-0-1)', duration: '5 days', instructions: 'At bedtime' }
      ];

      const ocrResult = {
        documentId: documentId || 'doc-scan',
        rawExtractedText: simulatedRawText,
        confidence: 0.92,
        candidateMedicines: parsedCandidateMedicines,
        verificationStatus: 'unverified', // Strictly requires doctor verification
        notice: 'IMPORTANT: OCR extracted text is for reference only. A licensed physician must review, correct, and verify before use.'
      };

      return res.json(ocrResult);
    } catch (err) {
      console.error('OCR error:', err);
      return res.status(500).json({ error: 'Failed to process document OCR' });
    }
  },

  // Save verified transcription to document metadata (Doctor only)
  async saveVerifiedTranscription(req, res) {
    try {
      const { documentId, verifiedText, verifiedMedicines, doctorNotes } = req.body;
      const clinicId = req.user.clinicId;

      const document = await dbService.getDocument('medicalDocuments', documentId);
      if (!document || document.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Medical document not found' });
      }

      const verifiedTranscription = {
        verifiedText: verifiedText || '',
        verifiedMedicines: verifiedMedicines || [],
        doctorNotes: doctorNotes || '',
        verifiedBy: req.user.id,
        verifiedByName: req.user.name,
        verifiedAt: new Date().toISOString(),
        isDoctorVerified: true
      };

      const updated = await dbService.updateDocument('medicalDocuments', documentId, {
        transcription: verifiedTranscription
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'OCR_TRANSCRIPTION_VERIFIED',
        resourceType: 'medicalDocuments',
        resourceId: documentId,
        details: { verifiedByName: req.user.name, patientId: document.patientId }
      });

      return res.json({
        message: 'Prescription transcription verified and attached to document successfully',
        document: updated
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save verified transcription' });
    }
  }
};
