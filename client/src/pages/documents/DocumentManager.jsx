import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Eye,
  Camera,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  Search,
  ExternalLink
} from 'lucide-react';
import { api } from '../../services/api.js';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { formatDate } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect.jsx';

const CATEGORIES = [
  'Handwritten Prescription',
  'Blood Report',
  'X-Ray',
  'ECG',
  'CT & MRI Report',
  'Ultrasound Report',
  'Discharge Summary',
  'Other Medical Document'
];

export const DocumentManager = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [documents, setDocuments] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadPatientId, setUploadPatientId] = useState('');
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [originalDate, setOriginalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState(null);

  // OCR Modal State
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [activeOcrDoc, setActiveOcrDoc] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [verifiedText, setVerifiedText] = useState('');
  const [isSavingOcr, setIsSavingOcr] = useState(false);

  const { role } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    api.patients.list({ limit: 500 })
      .then(res => {
        const list = res.patients || [];
        setPatients(list);
        if (list.length > 0 && !selectedPatientId) {
          setSelectedPatientId(list[0].id);
        }
      })
      .catch(err => console.error(err));
  }, []);

  const loadDocuments = async () => {
    if (!selectedPatientId) return;
    setIsLoading(true);
    try {
      const docs = await api.documents.getByPatient(selectedPatientId, {
        ...(categoryFilter && { category: categoryFilter })
      });
      setDocuments(docs || []);
    } catch (err) {
      showToast('Failed to load patient documents', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedPatientId, categoryFilter]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadPatientId || !selectedFile) {
      showToast('Please select a patient and a document file', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('patientId', uploadPatientId);
    formData.append('category', uploadCategory);
    formData.append('title', uploadTitle || selectedFile.name);
    formData.append('originalDocumentDate', originalDate);
    formData.append('notes', uploadNotes);

    setIsUploading(true);
    try {
      await api.documents.upload(formData);
      showToast('Medical document uploaded successfully!', 'success');
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadNotes('');
      if (selectedPatientId === uploadPatientId) {
        loadDocuments();
      } else {
        setSelectedPatientId(uploadPatientId);
      }
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartOcr = async (doc) => {
    setActiveOcrDoc(doc);
    setOcrModalOpen(true);
    setOcrLoading(true);
    setOcrResult(null);

    try {
      const res = await api.ocr.transcribe({ documentId: doc.id });
      setOcrResult(res);
      setVerifiedText(res.rawExtractedText || '');
    } catch (err) {
      showToast(err.message || 'OCR processing failed', 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleVerifyOcr = async () => {
    if (!activeOcrDoc) return;
    setIsSavingOcr(true);
    try {
      await api.ocr.verify({
        documentId: activeOcrDoc.id,
        verifiedText,
        verifiedMedicines: ocrResult?.candidateMedicines || [],
        doctorNotes: 'Doctor verified OCR transcription'
      });
      showToast('Transcription verified and linked to document record!', 'success');
      setOcrModalOpen(false);
      loadDocuments();
    } catch (err) {
      showToast(err.message || 'Verification save failed', 'error');
    } finally {
      setIsSavingOcr(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Archive this medical document?')) return;
    try {
      await api.documents.archive(docId);
      showToast('Document archived successfully', 'success');
      loadDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to archive document', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-purple-600" />
            Medical Document & Report Manager
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Securely store, categorize, view and transcribe patient diagnostic files.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploadPatientId(selectedPatientId || (patients[0]?.id || ''));
            setIsUploadModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Document / Scan
        </button>
      </div>

      {/* Patient & Category Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 w-full">
          <PatientSearchSelect
            patients={patients}
            value={selectedPatientId}
            onChange={(id) => setSelectedPatientId(id)}
            label="Viewing Documents For Patient"
          />
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            Category Filter:
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Document Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
        {isLoading ? (
          <LoadingSpinner message="Fetching medical files..." />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No medical documents uploaded"
            description="Upload diagnostic lab tests, scans, or handwritten prescription photos."
            actionText="Upload Document"
            onAction={() => {
              setUploadPatientId(selectedPatientId);
              setIsUploadModalOpen(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {documents.map(d => (
              <div
                key={d.id}
                className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      {d.category}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{formatDate(d.originalDocumentDate)}</span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 truncate" title={d.title}>
                    {d.title || d.originalName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Uploaded by: {d.uploadedByName || 'Staff'}</p>

                  {d.transcription?.isDoctorVerified && (
                    <div className="mt-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Doctor Verified OCR
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(d)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>

                  {role === 'doctor' && (
                    <button
                      type="button"
                      onClick={() => handleStartOcr(d)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> OCR Review
                    </button>
                  )}

                  {role === 'doctor' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Patient Medical Document"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <PatientSearchSelect
              patients={patients}
              value={uploadPatientId}
              onChange={(id) => setUploadPatientId(id)}
              label="Patient"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Category *
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Original Document Date
              </label>
              <input
                type="date"
                value={originalDate}
                onChange={(e) => setOriginalDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Document Title / Label
            </label>
            <input
              type="text"
              placeholder="e.g. CBC Blood Report, Chest X-Ray PA View"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select File or Camera Scan (JPG, PNG, PDF up to 15MB) *
            </label>
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              capture="environment"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Clinical Notes
            </label>
            <textarea
              rows="2"
              placeholder="Any diagnostic notes or doctor remarks"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Save Document'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || 'Document Preview'}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          {previewDoc?.mimeType === 'application/pdf' ? (
            <iframe
              src={previewDoc?.fileUrl}
              className="w-full h-[65vh] rounded-xl border border-slate-200"
              title="PDF Viewer"
            />
          ) : (
            <div className="max-h-[65vh] overflow-auto flex items-center justify-center bg-slate-900 rounded-xl p-2">
              <img
                src={previewDoc?.fileUrl}
                alt={previewDoc?.title}
                className="max-h-full max-w-full object-contain rounded"
              />
            </div>
          )}

          <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t">
            <span>Category: {previewDoc?.category}</span>
            <a
              href={previewDoc?.fileUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand-600 flex items-center gap-1"
            >
              <Download className="w-4 h-4" /> Open / Download File
            </a>
          </div>
        </div>
      </Modal>

      {/* OCR Transcription & Doctor Verification Modal (Module 11) */}
      <Modal
        isOpen={ocrModalOpen}
        onClose={() => setOcrModalOpen(false)}
        title="OCR Handwritten Prescription Transcription Review"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-800 text-xs">
            <strong className="block font-bold">Physician Human-in-the-Loop Protocol:</strong>
            OCR extracted text cannot diagnose or prescribe medicines automatically. The physician must review, correct, and verify before saving.
          </div>

          {ocrLoading ? (
            <LoadingSpinner message="Extracting prescription text using OCR engine..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Document Image View */}
              <div className="bg-slate-100 p-2 rounded-xl flex items-center justify-center max-h-96 overflow-auto">
                {activeOcrDoc?.mimeType?.includes('image') ? (
                  <img
                    src={activeOcrDoc?.fileUrl}
                    alt="Original Document"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                    <span>PDF Document: {activeOcrDoc?.originalName}</span>
                  </div>
                )}
              </div>

              {/* Editable Transcription Box */}
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Extracted Text (Edit / Correct as required):
                  </label>
                  <textarea
                    rows="10"
                    value={verifiedText}
                    onChange={(e) => setVerifiedText(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Identified Candidate Medicines:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {(ocrResult?.candidateMedicines || []).map((m, idx) => (
                      <li key={idx}>
                        <strong className="text-slate-800">{m.name} {m.strength}</strong> - {m.frequency} ({m.duration})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setOcrModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSavingOcr || ocrLoading}
              onClick={handleVerifyOcr}
              className="px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSavingOcr ? 'Saving...' : 'Verify & Link Transcription'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

