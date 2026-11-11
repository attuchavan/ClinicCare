import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Phone,
  Droplet,
  AlertTriangle,
  Calendar,
  FileText,
  Stethoscope,
  Clock,
  Receipt,
  Download,
  Plus,
  Eye,
  CheckCircle2,
  ArrowLeft,
  Upload,
  Camera
} from 'lucide-react';
import { api } from '../../services/api.js';
import { pdfService } from '../../services/pdfGenerator.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { formatDate, formatDateTime, formatCurrency, calculateAge, getStatusBadgeStyle } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PreviousPrescriptionsModal } from '../../components/prescriptions/PreviousPrescriptionsModal.jsx';
import { validateAmount } from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

export const PatientProfile = () => {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [timeline, setTimeline] = useState([]);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [bills, setBills] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [prevRxModalOpen, setPrevRxModalOpen] = useState(false);

  // Quick Bill Modal
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billConsultFee, setBillConsultFee] = useState(500); // In rupees
  const [billPaidAmount, setBillPaidAmount] = useState(500);
  const [billPaymentMethod, setBillPaymentMethod] = useState('cash');

  const billFormRef = useRef(null);
  const billInteraction = useFormInteraction();

  const feeValidation = validateAmount(billConsultFee, 'Consultation fee', { required: true, min: 0, max: 1000000 });
  const maxPaid = Number.isFinite(Number(billConsultFee)) && Number(billConsultFee) >= 0 ? Number(billConsultFee) : 1000000;
  const paidValidation = validateAmount(billPaidAmount, 'Amount paid', { required: true, min: 0, max: maxPaid });

  const feeState = billInteraction.getFieldState('billConsultFee', feeValidation);
  const paidState = billInteraction.getFieldState('billPaidAmount', paidValidation);

  const { role, clinic } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const loadPatientData = async () => {
    setIsLoading(true);
    try {
      const [pat, timeData, prescs, docs, bList, fList] = await Promise.all([
        api.patients.get(id),
        api.patients.getTimeline(id, timelineFilter),
        api.prescriptions.getByPatient(id),
        api.documents.getByPatient(id),
        api.billing.list({ patientId: id }),
        api.followUps.list({ patientId: id })
      ]);

      setPatient(pat);
      setTimeline(timeData.timeline || []);
      setPrescriptions(prescs || []);
      setDocuments(docs || []);
      setBills(bList || []);
      setFollowUps(fList.followUps || []);

      if (role === 'doctor') {
        const consults = await api.consultations.getByPatient(id);
        setConsultations(consults || []);
      }
    } catch (err) {
      console.error('Error loading patient data:', err);
      showToast('Failed to load patient records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [id]);

  useEffect(() => {
    if (patient) {
      api.patients.getTimeline(id, timelineFilter)
        .then(res => setTimeline(res.timeline || []))
        .catch(err => console.error(err));
    }
  }, [timelineFilter]);

  const handleDownloadPrescription = (rx) => {
    try {
      pdfService.generatePrescriptionPDF(rx, clinic);
      showToast('Prescription PDF generated successfully', 'success');
    } catch (err) {
      showToast('Failed to generate PDF', 'error');
    }
  };

  const handleDownloadReceipt = (bill) => {
    try {
      pdfService.generateReceiptPDF(bill, clinic);
      showToast('Receipt PDF generated successfully', 'success');
    } catch (err) {
      showToast('Failed to generate receipt', 'error');
    }
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    billInteraction.setSubmitted(true);
    if (!feeValidation.valid || !paidValidation.valid) {
      showToast(feeValidation.error || paidValidation.error || 'Please check billing amounts', 'warning');
      focusFirstInvalidField(billFormRef.current);
      return;
    }

    try {
      const billData = {
        patientId: id,
        consultationFee: Math.round(Number(billConsultFee) * 100), // convert to paise
        paidAmount: Math.round(Number(billPaidAmount) * 100),
        paymentMethod: billPaymentMethod
      };
      const newBill = await api.billing.create(billData);
      showToast(`Receipt #${newBill.receiptNumber} generated!`, 'success');
      setIsBillModalOpen(false);
      billInteraction.resetInteraction();
      loadPatientData();
      handleDownloadReceipt(newBill);
    } catch (err) {
      showToast(err.message || 'Failed to create bill', 'error');
    }
  };

  if (isLoading || !patient) {
    return <LoadingSpinner message="Loading patient medical history..." size="lg" />;
  }

  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <button
        type="button"
        onClick={() => navigate(role === 'doctor' ? '/doctor/patients' : '/receptionist/patients')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Patient Directory
      </button>

      {/* Patient Profile Card Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-700 font-extrabold text-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
              {patient.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-navy-900">{patient.fullName}</h1>
                <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                  {patient.patientId}
                </span>
                {patient.bloodGroup && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    <Droplet className="w-3 h-3 fill-current text-rose-500" />
                    {patient.bloodGroup}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                <span>{age ? `${age} Years Old` : 'Age Unspecified'} • {patient.gender}</span>
                <span className="flex items-center gap-1 text-slate-700 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {patient.mobileNumber}
                </span>
                {patient.address && <span>{patient.address}</span>}
              </div>

              {patient.allergies && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>Allergies: {patient.allergies}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Previous Prescriptions & Camera Button */}
            <button
              type="button"
              onClick={() => setPrevRxModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-bold transition-all shadow-xs"
              title="View past prescriptions, take photo with camera, or enter manually"
            >
              <Camera className="w-4 h-4 text-teal-600" />
              <span>Past Prescriptions & Camera</span>
            </button>

            {role === 'doctor' && (
              <button
                type="button"
                onClick={() => navigate(`/doctor/case-paper?patientId=${patient.id}&name=${encodeURIComponent(patient.fullName)}`)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all"
              >
                <FileText className="w-4 h-4" />
                New Case Paper
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsBillModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Generate Bill
            </button>
          </div>
        </div>

        {patient.medicalHistory && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <strong className="text-slate-800">Medical History: </strong> {patient.medicalHistory}
          </div>
        )}
      </div>

      {/* Profile Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1">
        {[
          { key: 'timeline', label: 'Medical Timeline', count: timeline.length },
          ...(role === 'doctor' ? [{ key: 'consultations', label: 'Consultations', count: consultations.length }] : []),
          { key: 'prescriptions', label: 'Prescriptions', count: prescriptions.length },
          { key: 'documents', label: 'Reports & Documents', count: documents.length },
          { key: 'billing', label: 'Bills & Payments', count: bills.length },
          { key: 'followups', label: 'Follow-ups', count: followUps.length },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === tab.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
              }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Chronological Medical Timeline (Module 7) */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Chronological Medical Timeline</h3>
            <div className="flex gap-1.5 text-xs">
              {['all', 'consultations', 'prescriptions', 'reports', 'bills'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTimelineFilter(f)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors ${timelineFilter === f
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {timeline.length === 0 ? (
            <EmptyState title="No timeline records" description="No events recorded for this patient under the selected filter." />
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {timeline.map(item => {
                let badgeBg = 'bg-blue-500';
                if (item.type === 'consultation') badgeBg = 'bg-brand-600';
                if (item.type === 'prescription') badgeBg = 'bg-teal-600';
                if (item.type === 'document') badgeBg = 'bg-purple-600';
                if (item.type === 'bill') badgeBg = 'bg-emerald-600';

                return (
                  <div key={item.id} className="relative flex items-start gap-4">
                    <span className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ${badgeBg} ring-4 ring-white`} />
                    <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-sm text-slate-900">{item.title}</span>
                        <span className="text-xs text-slate-400 font-medium">{formatDateTime(item.date)}</span>
                      </div>
                      <p className="text-xs text-slate-600">{item.description}</p>

                      {item.type === 'prescription' && (
                        <button
                          type="button"
                          onClick={() => handleDownloadPrescription(item.data)}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Prescription PDF
                        </button>
                      )}

                      {item.type === 'bill' && (
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(item.data)}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Receipt PDF
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Consultations (Doctor Only) */}
      {activeTab === 'consultations' && role === 'doctor' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">Clinical Consultations</h3>
            <button
              type="button"
              onClick={() => navigate(`/doctor/consultations/new?patientId=${patient.id}&name=${encodeURIComponent(patient.fullName)}`)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> New Consultation
            </button>
          </div>

          {consultations.length === 0 ? (
            <EmptyState title="No consultations recorded" description="Start a clinical consultation to record symptoms, vitals, and diagnosis." />
          ) : (
            <div className="space-y-4">
              {consultations.map(c => (
                <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="font-bold text-base text-slate-900">{c.diagnosis}</h4>
                      <p className="text-xs text-slate-400">Date: {formatDateTime(c.consultationDate || c.createdAt)}</p>
                    </div>
                    {c.followUpDate && (
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                        Follow-up: {formatDate(c.followUpDate)}
                      </span>
                    )}
                  </div>

                  {/* Vitals Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl text-xs">
                    <div><span className="text-slate-400 block">Blood Pressure:</span> <strong className="text-slate-800">{c.vitals?.bp || '-'}</strong></div>
                    <div><span className="text-slate-400 block">Pulse:</span> <strong className="text-slate-800">{c.vitals?.pulse ? `${c.vitals.pulse} bpm` : '-'}</strong></div>
                    <div><span className="text-slate-400 block">Temp:</span> <strong className="text-slate-800">{c.vitals?.temp ? `${c.vitals.temp} °F` : '-'}</strong></div>
                    <div><span className="text-slate-400 block">SpO2:</span> <strong className="text-slate-800">{c.vitals?.spo2 ? `${c.vitals.spo2} %` : '-'}</strong></div>
                    <div><span className="text-slate-400 block">Weight:</span> <strong className="text-slate-800">{c.vitals?.weight ? `${c.vitals.weight} kg` : '-'}</strong></div>
                  </div>

                  {c.symptoms && <p className="text-xs text-slate-700"><strong>Symptoms:</strong> {c.symptoms}</p>}
                  {c.examinationFindings && <p className="text-xs text-slate-700"><strong>Examination:</strong> {c.examinationFindings}</p>}
                  {c.treatmentNotes && <p className="text-xs text-slate-700"><strong>Treatment Notes:</strong> {c.treatmentNotes}</p>}
                  {c.doctorAdvice && <p className="text-xs text-teal-800 bg-teal-50 p-2.5 rounded-lg"><strong>Advice:</strong> {c.doctorAdvice}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Prescriptions */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">Prescription Records</h3>
            {role === 'doctor' && (
              <button
                type="button"
                onClick={() => navigate(`/doctor/prescriptions/new?patientId=${patient.id}`)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> Write Prescription
              </button>
            )}
          </div>

          {prescriptions.length === 0 ? (
            <EmptyState title="No prescriptions found" description="No digital prescriptions have been issued yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prescriptions.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        #{p.rxNumber || p.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(p.prescriptionDate || p.createdAt)}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{p.diagnosis || 'Prescription'}</h4>
                    <p className="text-xs text-slate-500 mb-3">{(p.medicines || []).length} Medicines prescribed</p>

                    <div className="space-y-1.5 border-t border-slate-100 pt-3">
                      {(p.medicines || []).slice(0, 3).map((m, i) => (
                        <div key={i} className="text-xs flex justify-between text-slate-700">
                          <span className="font-medium">• {m.name} {m.strength}</span>
                          <span className="text-slate-400">{m.frequency} ({m.duration})</span>
                        </div>
                      ))}
                      {(p.medicines || []).length > 3 && (
                        <p className="text-[11px] text-slate-400 italic">+{p.medicines.length - 3} more medicines</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownloadPrescription(p)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Reports & Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">Medical Reports & Documents</h3>
            <button
              type="button"
              onClick={() => navigate(role === 'doctor' ? '/doctor/documents' : '/receptionist/documents')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Document
            </button>
          </div>

          {documents.length === 0 ? (
            <EmptyState title="No documents uploaded" description="Upload blood reports, scans, or handwritten prescriptions." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {documents.map(d => (
                <div key={d.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      {d.category}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 mt-2 truncate">{d.title || d.originalName}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Doc Date: {formatDate(d.originalDocumentDate)}</p>
                    {d.notes && <p className="text-xs text-slate-600 mt-2 italic">"{d.notes}"</p>}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{(d.fileSize / 1024).toFixed(0)} KB</span>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
                    >
                      <Eye className="w-3.5 h-3.5" /> View File
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Billing & Payments */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">Billing History & Receipts</h3>
            <button
              type="button"
              onClick={() => setIsBillModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Create Bill
            </button>
          </div>

          {bills.length === 0 ? (
            <EmptyState title="No billing records" description="No receipts or bills have been generated for this patient." />
          ) : (
            <div className="space-y-3">
              {bills.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-800">{b.receiptNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${getStatusBadgeStyle(b.paymentStatus)}`}>
                        {b.paymentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Date: {formatDate(b.createdAt)} • Mode: {b.paymentMethod.toUpperCase()}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Total: {formatCurrency(b.totalAmount)}</span>
                      <span className="text-sm font-bold text-emerald-600">Paid: {formatCurrency(b.paidAmount)}</span>
                      {b.pendingAmount > 0 && (
                        <span className="text-xs font-bold text-rose-600 block">Pending: {formatCurrency(b.pendingAmount)}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(b)}
                      className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Download Official Receipt PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Follow-ups */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Scheduled Follow-up Visits</h3>
          {followUps.length === 0 ? (
            <EmptyState title="No follow-ups" description="No future review appointments scheduled for this patient." />
          ) : (
            <div className="space-y-3">
              {followUps.map(f => (
                <div key={f.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">{f.diagnosis || 'Routine Review'}</span>
                    <span className="text-xs text-slate-500">Scheduled Due Date: {formatDate(f.followUpDate)}</span>
                    {f.notes && <p className="text-xs text-slate-600 mt-1 italic">"{f.notes}"</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${getStatusBadgeStyle(f.status)}`}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Bill Modal */}
      <Modal
        isOpen={isBillModalOpen}
        onClose={() => {
          setIsBillModalOpen(false);
          billInteraction.resetInteraction();
        }}
        title="Generate Official Clinic Receipt"
        maxWidth="max-w-md"
      >
        <form ref={billFormRef} noValidate onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <label htmlFor="pp-consult-fee" className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Consultation Fee (₹) *
            </label>
            <input
              id="pp-consult-fee"
              type="text"
              inputMode="decimal"
              required
              value={billConsultFee}
              aria-invalid={feeState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'pp-consult-fee-error',
                showError: feeState.showError
              })}
              onChange={(e) => setBillConsultFee(e.target.value)}
              onBlur={() => billInteraction.markTouched('billConsultFee', feeValidation, 'Consultation fee')}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(feeState)}`}
            />
            <FieldFeedback id="pp-consult-fee-error" state={feeState} />
          </div>

          <div>
            <label htmlFor="pp-paid-amount" className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Amount Paid Today (₹) *
            </label>
            <input
              id="pp-paid-amount"
              type="text"
              inputMode="decimal"
              required
              value={billPaidAmount}
              aria-invalid={paidState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'pp-paid-amount-error',
                showError: paidState.showError
              })}
              onChange={(e) => setBillPaidAmount(e.target.value)}
              onBlur={() => billInteraction.markTouched('billPaidAmount', paidValidation, 'Amount paid today')}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-emerald-700 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(paidState)}`}
            />
            <FieldFeedback id="pp-paid-amount-error" state={paidState} />
          </div>

          <div>
            <label htmlFor="pp-pay-method" className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Payment Method
            </label>
            <select
              id="pp-pay-method"
              value={billPaymentMethod}
              onChange={(e) => setBillPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="card">Credit / Debit Card</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsBillModalOpen(false);
                billInteraction.resetInteraction();
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
            >
              Generate & Download Receipt
            </button>
          </div>
        </form>
      </Modal>

      {/* Previous Prescriptions & Camera Capture Modal */}
      {prevRxModalOpen && (
        <PreviousPrescriptionsModal
          isOpen={prevRxModalOpen}
          onClose={() => setPrevRxModalOpen(false)}
          patientId={patient.id}
          patientName={patient.fullName}
          onPrescriptionAdded={loadPatientData}
        />
      )}
    </div>
  );
};

