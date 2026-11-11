import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  FileText,
  Plus,
  CheckCircle2,
  X,
  Download,
  AlertCircle,
  FileImage,
  RefreshCw,
  Pill,
  Stethoscope,
  Calendar
} from 'lucide-react';
import { api } from '../../services/api.js';
import { Modal } from '../common/Modal.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { formatDate } from '../../utils/formatters.js';
import { useToast } from '../../context/ToastContext.jsx';
import { pdfService } from '../../services/pdfGenerator.js';
import { useAuth } from '../../context/AuthContext.jsx';

export const PreviousPrescriptionsModal = ({
  isOpen,
  onClose,
  patientId,
  patientName = 'Patient',
  onPrescriptionAdded
}) => {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'camera' | 'upload' | 'manual'
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [clinicPrescriptions, setClinicPrescriptions] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null); // { source: 'doc'|'rx', data: ... }

  // Form states
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [prescribedMedicines, setPrescribedMedicines] = useState('');
  const [notes, setNotes] = useState('');

  // File / Camera state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();
  const { clinic } = useAuth();

  const loadPrescriptions = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await api.documents.getPreviousPrescriptions(patientId);
      const docs = data.documents || [];
      const rxs = data.clinicPrescriptions || [];
      setDocuments(docs);
      setClinicPrescriptions(rxs);

      // Automatically select first item for immediate preview so there is no empty blank panel
      if (docs.length > 0) {
        setSelectedRecord({ source: 'doc', data: docs[0] });
      } else if (rxs.length > 0) {
        setSelectedRecord({ source: 'rx', data: rxs[0] });
      } else {
        setSelectedRecord(null);
      }
    } catch (err) {
      console.error('Failed to load previous prescriptions:', err);
      showToast('Could not fetch previous prescriptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && patientId) {
      setActiveTab('list');
      loadPrescriptions();
      resetForm();
    }
  }, [isOpen, patientId]);

  const resetForm = () => {
    setDoctorName('');
    setPrescriptionDate(new Date().toISOString().slice(0, 10));
    setPrescribedMedicines('');
    setNotes('');
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('File size must be under 15MB', 'warning');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handlePhotoOrFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please capture or select a photo/PDF first', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('patientId', patientId);
      formData.append('category', 'Previous Prescription');
      formData.append('title', `Previous Rx - ${doctorName || 'External Doctor'}`);
      formData.append('doctorName', doctorName);
      formData.append('originalDocumentDate', prescriptionDate);
      formData.append('prescribedMedicines', prescribedMedicines);
      formData.append('notes', notes);

      await api.documents.upload(formData);
      showToast('Prescription photo saved!', 'success');
      resetForm();
      setActiveTab('list');
      await loadPrescriptions();
      if (onPrescriptionAdded) onPrescriptionAdded();
    } catch (err) {
      showToast(err.message || 'Failed to save prescription file', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!prescribedMedicines.trim() && !notes.trim()) {
      showToast('Please enter the medicines or clinical notes', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.documents.saveManualPrescription({
        patientId,
        doctorName: doctorName || 'External Doctor',
        originalDocumentDate: prescriptionDate,
        prescribedMedicines,
        notes,
        title: `Previous Rx - ${doctorName || 'External Doctor'}`
      });

      showToast('Manual previous prescription saved!', 'success');
      resetForm();
      setActiveTab('list');
      await loadPrescriptions();
      if (onPrescriptionAdded) onPrescriptionAdded();
    } catch (err) {
      showToast(err.message || 'Failed to save manual entry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadClinicRx = (rx) => {
    try {
      pdfService.generatePrescriptionPDF(rx, clinic);
      showToast('Prescription PDF downloaded', 'success');
    } catch {
      showToast('Failed to generate PDF', 'error');
    }
  };

  const totalCount = documents.length + clinicPrescriptions.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Previous Prescriptions & Medical Slips"
      subtitle={`Patient: ${patientName} • ${totalCount} record${totalCount === 1 ? '' : 's'} on file`}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5">
        {/* Clean Segmented Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="inline-flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              History
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                {totalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('camera');
                setTimeout(() => cameraInputRef.current?.click(), 80);
              }}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'camera'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Take Photo
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload PDF / Photo
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'manual'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Type Manually
            </button>
          </div>

          <button
            type="button"
            onClick={loadPrescriptions}
            title="Refresh records"
            className="p-2 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* TAB 1: SPLIT-PANE MASTER-DETAIL HISTORY VIEW */}
        {activeTab === 'list' && (
          <div>
            {loading ? (
              <LoadingSpinner message="Loading previous prescriptions..." />
            ) : totalCount === 0 ? (
              <div className="py-10 px-6 text-center space-y-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                  <FileImage className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">No Previous Prescriptions Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Did the patient bring an old paper prescription or medicine strip? Snap a quick photo or type the medicines below.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('camera');
                      setTimeout(() => cameraInputRef.current?.click(), 80);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo with Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Type Details Manually
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* LEFT COLUMN: PRESCRIPTION LIST (5 cols) */}
                <div className="md:col-span-5 space-y-2.5 max-h-[58vh] overflow-y-auto pr-1">
                  {documents.map((doc) => {
                    const isSelected = selectedRecord?.source === 'doc' && selectedRecord.data.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedRecord({ source: 'doc', data: doc })}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {doc.isManualEntry ? 'Manual Entry' : (doc.mimeType?.includes('pdf') ? 'PDF Slip' : 'Photo Slip')}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {formatDate(doc.originalDocumentDate || doc.createdAt)}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 truncate">
                          {doc.doctorName ? `Dr. ${doc.doctorName.replace(/^Dr\.?\s*/i, '')}` : doc.title}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {doc.prescribedMedicines || doc.notes || 'Attached prescription document'}
                        </p>
                      </button>
                    );
                  })}

                  {clinicPrescriptions.map((rx) => {
                    const isSelected = selectedRecord?.source === 'rx' && selectedRecord.data.id === rx.id;
                    return (
                      <button
                        key={rx.id}
                        type="button"
                        onClick={() => setSelectedRecord({ source: 'rx', data: rx })}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                            Clinic Rx #{rx.rxNumber || rx.id.slice(0, 6)}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {formatDate(rx.prescriptionDate || rx.createdAt)}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 truncate">
                          {rx.diagnosis || 'General Consultation'}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {(rx.medicines || []).length} medicines • Dr. {rx.doctorName || 'Rajesh Sharma'}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* RIGHT COLUMN: ACTIVE PREVIEW PANEL (7 cols) */}
                <div className="md:col-span-7 bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 min-h-[340px] flex flex-col justify-between">
                  {selectedRecord?.source === 'doc' && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded">
                            {selectedRecord.data.isManualEntry ? 'Manual Prescription Record' : 'Uploaded Prescription'}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900 mt-1">
                            {selectedRecord.data.doctorName || selectedRecord.data.title}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(selectedRecord.data.originalDocumentDate || selectedRecord.data.createdAt)}
                            <span>•</span>
                            Recorded by {selectedRecord.data.uploadedByName || 'Staff'}
                          </p>
                        </div>

                        {selectedRecord.data.fileUrl && (
                          <a
                            href={selectedRecord.data.fileUrl}
                            download={selectedRecord.data.originalName || 'prescription'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-teal-400 text-xs font-bold text-slate-700 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5 text-teal-600" />
                            Open / Download
                          </a>
                        )}
                      </div>

                      {selectedRecord.data.fileUrl && (
                        <div className="bg-slate-900 rounded-xl p-2 flex items-center justify-center max-h-72 overflow-hidden border border-slate-200">
                          {selectedRecord.data.mimeType?.includes('pdf') ? (
                            <iframe
                              src={selectedRecord.data.fileUrl}
                              title="Prescription PDF"
                              className="w-full h-64 rounded-lg bg-white"
                            />
                          ) : (
                            <img
                              src={selectedRecord.data.fileUrl}
                              alt={selectedRecord.data.title}
                              className="max-h-64 max-w-full object-contain rounded-lg"
                            />
                          )}
                        </div>
                      )}

                      {selectedRecord.data.prescribedMedicines && (
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Recorded Medicines & Dosage
                          </span>
                          <pre className="text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                            {selectedRecord.data.prescribedMedicines}
                          </pre>
                        </div>
                      )}

                      {selectedRecord.data.notes && (
                        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                          <strong className="font-bold">Notes:</strong> {selectedRecord.data.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedRecord?.source === 'rx' && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                            ClinicCare Digital Prescription #{selectedRecord.data.rxNumber || selectedRecord.data.id.slice(0, 8)}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900 mt-1">
                            {selectedRecord.data.diagnosis || 'General Consultation'}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                            Dr. {selectedRecord.data.doctorName || 'Rajesh Sharma'} • {formatDate(selectedRecord.data.prescriptionDate || selectedRecord.data.createdAt)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadClinicRx(selectedRecord.data)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-xs font-bold text-white shadow-xs transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                      </div>

                      {/* Medicines Table */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-3.5 py-2 bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5 text-teal-600" />
                          Prescribed Medicines ({(selectedRecord.data.medicines || []).length})
                        </div>
                        <div className="divide-y divide-slate-100">
                          {(selectedRecord.data.medicines || []).map((med, i) => (
                            <div key={i} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-bold text-slate-900">{i + 1}. {med.name} {med.strength || ''}</p>
                                {med.instructions && (
                                  <p className="text-[11px] text-slate-500">{med.instructions}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800">
                                  {med.frequency || med.dosage || '1-0-1'}
                                </span>
                                <p className="text-[11px] text-slate-500 mt-0.5">{med.duration || ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {selectedRecord.data.doctorAdvice && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                          <strong className="font-bold text-slate-900">Doctor's Advice:</strong> {selectedRecord.data.doctorAdvice}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2 & TAB 3: CAMERA CAPTURE / UPLOAD FORM */}
        {(activeTab === 'camera' || activeTab === 'upload') && (
          <form onSubmit={handlePhotoOrFileUpload} className="space-y-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="border-2 border-dashed border-teal-300 bg-teal-50/40 rounded-2xl p-6 text-center space-y-3">
              {previewUrl ? (
                <div className="space-y-2.5">
                  <div className="relative inline-block border-2 border-teal-500 rounded-xl overflow-hidden shadow-md bg-white">
                    <img src={previewUrl} alt="Captured Prescription" className="max-h-56 object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-full shadow hover:bg-rose-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-teal-800">
                    Ready to upload: {selectedFile?.name}
                  </p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-2">
                  <div className="p-3 bg-white border border-teal-200 rounded-xl inline-flex items-center gap-2 text-xs font-bold text-teal-900">
                    <FileText className="w-5 h-5 text-teal-600" />
                    {selectedFile.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="block mx-auto text-xs text-rose-600 hover:underline font-medium"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mx-auto">
                    {activeTab === 'camera' ? <Camera className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {activeTab === 'camera' ? 'Take Photo of Old Prescription' : 'Select Prescription Image or PDF'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => (activeTab === 'camera' ? cameraInputRef.current?.click() : fileInputRef.current?.click())}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    {activeTab === 'camera' ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    {activeTab === 'camera' ? 'Open Camera' : 'Choose File'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Doctor / Clinic Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Mehta"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prescription Date</label>
                <input
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => setPrescriptionDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quick Medicine Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Write key medicines visible on the paper slip..."
                value={prescribedMedicines}
                onChange={(e) => setPrescribedMedicines(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedFile}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSubmitting ? 'Saving...' : 'Save to Patient Record'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: MANUAL ENTRY FORM */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Type the old medicines the patient is currently taking so the doctor can review them immediately.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Previous Doctor / Hospital *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. K. M. Mehta"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => setPrescriptionDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Previous Medicines & Dosage *</label>
              <textarea
                rows={4}
                required
                placeholder="1. Tab Telmisartan 40mg (1-0-0)&#10;2. Tab Metformin 500mg (1-0-1)"
                value={prescribedMedicines}
                onChange={(e) => setPrescribedMedicines(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Additional Notes</label>
              <input
                type="text"
                placeholder="e.g. Patient has been taking this for 6 months"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSubmitting ? 'Saving...' : 'Save Previous Prescription'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
