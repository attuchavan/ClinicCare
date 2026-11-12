import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Printer,
  Save,
  Plus,
  Trash2,
  User,
  HeartPulse,
  Activity,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowLeft,
  Sparkles,
  Camera,
  Pill,
  Eye
} from 'lucide-react';
import { api } from '../../services/api.js';
import { pdfService } from '../../services/pdfGenerator.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { calculateAge, formatCurrency, formatDate } from '../../utils/formatters.js';
import { PreviousPrescriptionsModal } from '../../components/prescriptions/PreviousPrescriptionsModal.jsx';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect.jsx';
import {
  validateFullName,
  validateMobile,
  validateAge,
  validateRequiredText,
  validateAmount,
  validateVitalField,
  normalizeMobile
} from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

const COMMON_DOSAGES = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', 'SOS'];
const COMMON_DURATIONS = ['3 Days', '5 Days', '7 Days', '10 Days', '15 Days', '1 Month'];
const COMMON_INSTRUCTIONS = ['After Food', 'Before Food', 'With Warm Water', 'Bedtime'];

export const CasePaper = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clinic, role } = useAuth();
  const { showToast } = useToast();
  const caseFormRef = useRef(null);
  const cpInteraction = useFormInteraction();

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get('patientId') || '');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [appointmentId, setAppointmentId] = useState(searchParams.get('appointmentId') || '');
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevRxModalOpen, setPrevRxModalOpen] = useState(false);
  const [visitReason, setVisitReason] = useState(() => searchParams.get('reason') || '');
  const [prevRxData, setPrevRxData] = useState({ documents: [], clinicPrescriptions: [] });
  const [isLoadingPrevRx, setIsLoadingPrevRx] = useState(false);

  // Quick Walk-in Patient mode
  const [isQuickWalkIn, setIsQuickWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState(searchParams.get('name') || '');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInGender, setWalkInGender] = useState('Male');

  // Case Paper Form Data
  const [caseDate, setCaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vitals, setVitals] = useState({
    bp: '',
    pulse: '',
    temperature: '',
    weight: '',
    spo2: ''
  });
  const [symptoms, setSymptoms] = useState(() => searchParams.get('reason') || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '1-0-1', duration: '5 Days', instructions: 'After Food' }
  ]);
  const [advice, setAdvice] = useState('');
  const [followUpDays, setFollowUpDays] = useState('5');
  const [consultationFeeRupees, setConsultationFeeRupees] = useState(
    clinic?.consultationFee != null ? clinic.consultationFee / 100 : 500
  );
  const [syncedClinicFee, setSyncedClinicFee] = useState(clinic?.consultationFee ?? null);

  useEffect(() => {
    if (clinic?.consultationFee != null && clinic.consultationFee !== syncedClinicFee) {
      const prevDefaultRupees = syncedClinicFee != null ? syncedClinicFee / 100 : 500;
      if (Number(consultationFeeRupees) === prevDefaultRupees) {
        setConsultationFeeRupees(clinic.consultationFee / 100);
      }
      setSyncedClinicFee(clinic.consultationFee);
    }
  }, [clinic?.consultationFee, syncedClinicFee, consultationFeeRupees]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Load patient directory
  useEffect(() => {
    api.patients.list({ limit: 500 })
      .then(res => setPatients(res.patients || []))
      .catch(err => console.error(err))
      .finally(() => setIsLoadingPatients(false));
  }, []);

  const fetchInlinePrevRx = async (patientId) => {
    if (!patientId) {
      setPrevRxData({ documents: [], clinicPrescriptions: [] });
      return;
    }
    setIsLoadingPrevRx(true);
    try {
      const res = await api.documents.getPreviousPrescriptions(patientId);
      setPrevRxData({
        documents: res.documents || [],
        clinicPrescriptions: res.clinicPrescriptions || []
      });
    } catch {
      setPrevRxData({ documents: [], clinicPrescriptions: [] });
    } finally {
      setIsLoadingPrevRx(false);
    }
  };

  // Update selected patient info & inline previous prescriptions
  useEffect(() => {
    if (selectedPatientId) {
      api.patients.get(selectedPatientId)
        .then(p => {
          setSelectedPatient(p);
          setIsQuickWalkIn(false);
        })
        .catch(err => console.error(err));

      fetchInlinePrevRx(selectedPatientId);

      // If arriving via appointmentId without query reason, fetch appointment reason
      if (appointmentId && !visitReason) {
        api.appointments.list({ patientId: selectedPatientId })
          .then(appts => {
            const match = (appts || []).find(a => a.id === appointmentId);
            if (match?.reason) {
              setVisitReason(match.reason);
              setSymptoms(prev => prev || match.reason);
            }
          })
          .catch(() => {});
      }
    } else {
      setSelectedPatient(null);
      setPrevRxData({ documents: [], clinicPrescriptions: [] });
    }
  }, [selectedPatientId]);

  // Handle Medicine Array
  const addMedicineRow = () => {
    setMedicines(prev => [
      ...prev,
      { name: '', dosage: '1-0-1', duration: '5 Days', instructions: 'After Food' }
    ]);
  };

  const removeMedicineRow = (index) => {
    setMedicines(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateMedicineRow = (index, field, value) => {
    setMedicines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Live computed validations for Case Paper fields
  const walkInNameValidation = validateFullName(walkInName, { label: 'Patient full name' });
  const walkInPhoneValidation = validateMobile(walkInPhone);
  const walkInAgeValidation = validateAge(walkInAge);
  const bpValidation = validateVitalField('bp', vitals.bp);
  const pulseValidation = validateVitalField('pulse', vitals.pulse);
  const tempValidation = validateVitalField('temperature', vitals.temperature);
  const weightValidation = validateVitalField('weight', vitals.weight);
  const spo2Validation = validateVitalField('spo2', vitals.spo2);
  const diagnosisValidation = validateRequiredText(diagnosis, 'Clinical diagnosis', { min: 2, max: 1000 });
  const feeValidation = validateAmount(consultationFeeRupees, 'Consultation fee', {
    required: false,
    min: 0,
    max: 100000
  });

  const walkInNameState = cpInteraction.getFieldState('walkInName', walkInNameValidation);
  const walkInPhoneState = cpInteraction.getFieldState('walkInPhone', walkInPhoneValidation);
  const walkInAgeState = cpInteraction.getFieldState('walkInAge', walkInAgeValidation);
  const bpState = cpInteraction.getFieldState('bp', bpValidation);
  const pulseState = cpInteraction.getFieldState('pulse', pulseValidation);
  const tempState = cpInteraction.getFieldState('temperature', tempValidation);
  const weightState = cpInteraction.getFieldState('weight', weightValidation);
  const spo2State = cpInteraction.getFieldState('spo2', spo2Validation);
  const diagnosisState = cpInteraction.getFieldState('diagnosis', diagnosisValidation);
  const feeState = cpInteraction.getFieldState('consultationFee', feeValidation);
  const validMedsCount = medicines.filter(m => m.name.trim() !== '').length;

  // Submit and optionally print
  const handleSaveCasePaper = async (shouldPrint = false) => {
    cpInteraction.setSubmitted(true);
    let patientIdToUse = selectedPatientId;
    const patientNameToUse = selectedPatient?.fullName || walkInName.trim();
    const patientPhoneToUse = selectedPatient?.mobileNumber || walkInPhoneValidation.normalized || normalizeMobile(walkInPhone);
    const patientAgeToUse = selectedPatient ? calculateAge(selectedPatient.dateOfBirth) : walkInAge;
    const patientGenderToUse = selectedPatient ? selectedPatient.gender : walkInGender;

    // Validate patient
    if (isQuickWalkIn) {
      if (!walkInNameValidation.valid || !walkInPhoneValidation.valid || !walkInAgeValidation.valid) {
        const firstErr = walkInNameValidation.error || walkInPhoneValidation.error || walkInAgeValidation.error;
        showToast(firstErr || 'Please fix the highlighted patient details', 'warning');
        focusFirstInvalidField(caseFormRef.current);
        return;
      }
    } else if (!selectedPatientId) {
      showToast('Please select a patient or switch to Quick Walk-in', 'warning');
      focusFirstInvalidField(caseFormRef.current);
      return;
    }

    const vitalChecks = [bpValidation, pulseValidation, tempValidation, weightValidation, spo2Validation];
    const invalidVital = vitalChecks.find(v => !v.valid);
    if (invalidVital) {
      showToast(invalidVital.error || 'Please correct invalid vital signs', 'warning');
      focusFirstInvalidField(caseFormRef.current);
      return;
    }

    if (!diagnosisValidation.valid) {
      showToast(diagnosisValidation.error || 'Please enter clinical diagnosis or findings', 'warning');
      focusFirstInvalidField(caseFormRef.current);
      return;
    }

    // Filter valid medicines
    const validMeds = medicines.filter(m => m.name.trim() !== '');
    if (validMeds.length === 0) {
      showToast('Please prescribe at least one medicine', 'warning');
      focusFirstInvalidField(caseFormRef.current);
      return;
    }

    if (!feeValidation.valid) {
      showToast(feeValidation.error || 'Please enter a valid consultation fee', 'warning');
      focusFirstInvalidField(caseFormRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: If quick walk-in, register patient first
      if (isQuickWalkIn && !patientIdToUse) {
        let dob = '';
        if (walkInAge && Number(walkInAge) > 0) {
          dob = `${new Date().getFullYear() - Number(walkInAge)}-01-01`;
        }
        const newPatient = await api.patients.register({
          fullName: walkInName.trim(),
          mobileNumber: patientPhoneToUse,
          gender: walkInGender,
          dateOfBirth: dob,
          medicalHistory: ''
        });
        patientIdToUse = newPatient.id;
        setSelectedPatientId(newPatient.id);
        setSelectedPatient(newPatient);
      }

      // Calculate follow-up date (only if followUpDays > 0)
      let followUpDateStr = '';
      if (followUpDays !== '' && followUpDays !== null && Number(followUpDays) > 0) {
        const followUpDateObj = new Date(caseDate);
        followUpDateObj.setDate(followUpDateObj.getDate() + Number(followUpDays));
        followUpDateStr = followUpDateObj.toISOString().slice(0, 10);
      }

      // Step 2: Save Consultation
      const consultation = await api.consultations.create({
        patientId: patientIdToUse,
        appointmentId: appointmentId || null,
        vitals,
        symptoms,
        diagnosis,
        doctorAdvice: advice,
        followUpDate: followUpDateStr
      });

      // Step 3: Save Prescription
      const rx = await api.prescriptions.create({
        patientId: patientIdToUse,
        consultationId: consultation.id,
        diagnosis,
        medicines: validMeds,
        generalAdvice: advice,
        followUpDate: followUpDateStr,
        status: 'approved'
      });

      // Step 4: Record Billing / Receipt
      const parsedFee =
        consultationFeeRupees === '' || consultationFeeRupees === null || consultationFeeRupees === undefined
          ? (clinic?.consultationFee != null ? clinic.consultationFee / 100 : 500)
          : Number(consultationFeeRupees);
      const feeInPaise = Math.max(0, Math.round(parsedFee * 100));
      let bill = null;
      try {
        bill = await api.billing.create({
          patientId: patientIdToUse,
          consultationFee: feeInPaise,
          paidAmount: feeInPaise,
          paymentMethod: paymentMethod.toLowerCase()
        });
      } catch (billErr) {
        console.warn('Billing note:', billErr.message);
      }

      // Step 5: Mark appointment completed if linked
      if (appointmentId) {
        try {
          await api.appointments.updateStatus(appointmentId, 'completed');
        } catch {}
      }

      showToast('Case paper saved successfully!', 'success');

      // Step 6: Print or Download PDF
      if (shouldPrint) {
        pdfService.generateCasePaperPDF({
          patient: {
            fullName: patientNameToUse,
            patientId: selectedPatient?.patientId || 'CC-NEW',
            age: patientAgeToUse,
            gender: patientGenderToUse,
            mobileNumber: patientPhoneToUse,
            bloodGroup: selectedPatient?.bloodGroup || '',
            allergies: selectedPatient?.allergies || ''
          },
          date: caseDate,
          vitals,
          symptoms,
          diagnosis,
          medicines: validMeds,
          advice,
          followUpDate: followUpDateStr,
          fee: consultationFeeRupees,
          receiptNumber: bill?.receiptNumber || rx.rxNumber
        }, clinic);
      }

      // Reset or redirect to patient profile
      navigate(`/${role}/patients/${patientIdToUse}`);
    } catch (err) {
      console.error('Case paper save error:', err);
      showToast(err.message || 'Failed to save case paper', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-teal-600" />
            OPD Case Paper & Prescription
          </h1>
          <p className="text-xs text-slate-500">
            Patient summary, chief complaint, past prescriptions, vitals, and Rx in one clean screen.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
          <Calendar className="w-4 h-4 text-teal-600" />
          <input
            type="date"
            value={caseDate}
            onChange={(e) => setCaseDate(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none"
          />
        </div>
      </div>

      {/* Why Patient Came Today Banner (Visible right at top from Receptionist Check-in) */}
      {visitReason && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-teal-600 text-white shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-800">
                Why Patient Came Today (Receptionist Note)
              </span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{visitReason}</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-teal-700 bg-white px-2.5 py-1 rounded-lg border border-teal-200 shrink-0">
            Pre-filled into Symptoms
          </span>
        </div>
      )}

      <form ref={caseFormRef} noValidate onSubmit={(e) => { e.preventDefault(); handleSaveCasePaper(false); }} className="space-y-6">
        {/* Section 1: Patient Information */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" />
              1. Patient Identification & Past Prescriptions
            </h2>

            <button
              type="button"
              onClick={() => {
                setIsQuickWalkIn(!isQuickWalkIn);
                setSelectedPatientId('');
                setSelectedPatient(null);
              }}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 underline"
            >
              {isQuickWalkIn ? '← Select Existing Patient' : '+ Quick Walk-in Patient'}
            </button>
          </div>

          {!isQuickWalkIn ? (
            <div>
              <PatientSearchSelect
                patients={patients}
                value={selectedPatientId}
                onChange={(id) => setSelectedPatientId(id)}
                label="Select Patient"
                required
                invalid={cpInteraction.submitted && !selectedPatientId}
                error={
                  cpInteraction.submitted && !selectedPatientId
                    ? 'Please select a patient from the directory or switch to Quick Walk-in.'
                    : ''
                }
              />

              {selectedPatient && (
                <div className="mt-3 space-y-3">
                  {/* Demographics & Allergies */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-700">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <span><strong className="text-slate-900">Age/Gender:</strong> {calculateAge(selectedPatient.dateOfBirth) || 'N/A'} Yrs • {selectedPatient.gender}</span>
                      <span><strong className="text-slate-900">Phone:</strong> {selectedPatient.mobileNumber}</span>
                      {selectedPatient.bloodGroup && <span><strong className="text-slate-900">Blood Group:</strong> {selectedPatient.bloodGroup}</span>}
                      {selectedPatient.allergies && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Allergies: {selectedPatient.allergies}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPrevRxModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Open Viewer / + Add Photo</span>
                    </button>
                  </div>

                  {/* Inline Previous Prescriptions & Photos Strip */}
                  <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-teal-600" />
                        Previous Prescriptions & Uploaded Photos (
                        {prevRxData.documents.length + prevRxData.clinicPrescriptions.length})
                      </span>
                      {(prevRxData.documents.length > 0 || prevRxData.clinicPrescriptions.length > 0) && (
                        <button
                          type="button"
                          onClick={() => setPrevRxModalOpen(true)}
                          className="text-xs font-bold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Full Split Viewer
                        </button>
                      )}
                    </div>

                    {isLoadingPrevRx ? (
                      <p className="text-xs text-slate-500">Checking previous prescriptions...</p>
                    ) : prevRxData.documents.length === 0 && prevRxData.clinicPrescriptions.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No past prescriptions uploaded yet. Receptionist or Doctor can add photos or manual notes anytime.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {prevRxData.documents.map(doc => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => setPrevRxModalOpen(true)}
                            className="flex items-start gap-3 p-2.5 rounded-xl bg-white border border-teal-200/80 hover:border-teal-500 text-left transition-all shadow-2xs"
                          >
                            {doc.fileUrl && !doc.mimeType?.includes('pdf') ? (
                              <img
                                src={doc.fileUrl}
                                alt={doc.title}
                                className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-teal-700" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {doc.doctorName || doc.title || 'Previous Prescription'}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                  {formatDate(doc.originalDocumentDate || doc.createdAt)}
                                </span>
                              </div>
                              {doc.prescribedMedicines ? (
                                <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 font-mono">
                                  {doc.prescribedMedicines}
                                </p>
                              ) : (
                                <p className="text-[11px] text-teal-700 font-semibold mt-0.5">
                                  Click to inspect photo / PDF →
                                </p>
                              )}
                            </div>
                          </button>
                        ))}

                        {prevRxData.clinicPrescriptions.map(rx => (
                          <button
                            key={rx.id}
                            type="button"
                            onClick={() => setPrevRxModalOpen(true)}
                            className="flex items-start gap-3 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-teal-500 text-left transition-all"
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <Pill className="w-4 h-4 text-teal-700" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {rx.diagnosis || 'Past Clinic Visit'}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                  {formatDate(rx.prescriptionDate || rx.createdAt)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 truncate mt-0.5">
                                {(rx.medicines || []).map(m => m.name).filter(Boolean).join(', ') || 'See details'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="cp-walkin-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Patient Full Name *
                </label>
                <input
                  id="cp-walkin-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Ramesh Kulkarni"
                  value={walkInName}
                  aria-invalid={walkInNameState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    errorId: 'cp-walkin-name-error',
                    showError: walkInNameState.showError
                  })}
                  onChange={(e) => setWalkInName(e.target.value)}
                  onBlur={() => cpInteraction.markTouched('walkInName', walkInNameValidation, 'Patient full name')}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(walkInNameState)}`}
                />
                <FieldFeedback id="cp-walkin-name-error" state={walkInNameState} />
              </div>
              <div>
                <label htmlFor="cp-walkin-mobile" className="block text-xs font-bold text-slate-700 mb-0.5">
                  Mobile Number *
                </label>
                <p id="cp-walkin-mobile-hint" className="text-[10px] text-slate-500 mb-1">
                  10 digits (6–9 start)
                </p>
                <input
                  id="cp-walkin-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={14}
                  required
                  placeholder="9822012345"
                  value={walkInPhone}
                  aria-invalid={walkInPhoneState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    hintId: 'cp-walkin-mobile-hint',
                    errorId: 'cp-walkin-mobile-error',
                    showError: walkInPhoneState.showError
                  })}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  onBlur={() => cpInteraction.markTouched('walkInPhone', walkInPhoneValidation, 'Mobile number')}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(walkInPhoneState)}`}
                />
                <FieldFeedback id="cp-walkin-mobile-error" state={walkInPhoneState} />
              </div>
              <div>
                <label htmlFor="cp-walkin-age" className="block text-xs font-bold text-slate-700 mb-1">
                  Age / Gender
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="cp-walkin-age"
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    placeholder="Age"
                    value={walkInAge}
                    aria-invalid={walkInAgeState.ariaInvalid}
                    aria-describedby={buildDescribedBy({
                      errorId: 'cp-walkin-age-error',
                      showError: walkInAgeState.showError
                    })}
                    onChange={(e) => setWalkInAge(e.target.value)}
                    onBlur={() => cpInteraction.markTouched('walkInAge', walkInAgeValidation, 'Age')}
                    className={`w-16 px-2 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(walkInAgeState)}`}
                  />
                  <select
                    aria-label="Gender"
                    value={walkInGender}
                    onChange={(e) => setWalkInGender(e.target.value)}
                    className="flex-1 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Male">M</option>
                    <option value="Female">F</option>
                    <option value="Other">O</option>
                  </select>
                </div>
                <FieldFeedback id="cp-walkin-age-error" state={walkInAgeState} compact />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Clinical Vitals Strip */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-rose-600" />
            2. Clinical Vitals
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label htmlFor="cp-vital-bp" className="block text-[11px] font-bold text-slate-600 mb-1">Blood Pressure</label>
              <input
                id="cp-vital-bp"
                type="text"
                placeholder="120/80"
                value={vitals.bp}
                aria-invalid={bpState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cp-vital-bp-error', showError: bpState.showError })}
                onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                onBlur={() => cpInteraction.markTouched('bp', bpValidation, 'Blood pressure')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 text-center focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(bpState)}`}
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5">mmHg</span>
              <FieldFeedback id="cp-vital-bp-error" state={bpState} compact />
            </div>

            <div>
              <label htmlFor="cp-vital-pulse" className="block text-[11px] font-bold text-slate-600 mb-1">Pulse Rate</label>
              <input
                id="cp-vital-pulse"
                type="text"
                inputMode="numeric"
                placeholder="76"
                value={vitals.pulse}
                aria-invalid={pulseState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cp-vital-pulse-error', showError: pulseState.showError })}
                onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                onBlur={() => cpInteraction.markTouched('pulse', pulseValidation, 'Pulse rate')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 text-center focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(pulseState)}`}
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5">bpm</span>
              <FieldFeedback id="cp-vital-pulse-error" state={pulseState} compact />
            </div>

            <div>
              <label htmlFor="cp-vital-temp" className="block text-[11px] font-bold text-slate-600 mb-1">Temperature</label>
              <input
                id="cp-vital-temp"
                type="text"
                inputMode="decimal"
                placeholder="98.6"
                value={vitals.temperature}
                aria-invalid={tempState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cp-vital-temp-error', showError: tempState.showError })}
                onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                onBlur={() => cpInteraction.markTouched('temperature', tempValidation, 'Temperature')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 text-center focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(tempState)}`}
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5">°F</span>
              <FieldFeedback id="cp-vital-temp-error" state={tempState} compact />
            </div>

            <div>
              <label htmlFor="cp-vital-weight" className="block text-[11px] font-bold text-slate-600 mb-1">Weight</label>
              <input
                id="cp-vital-weight"
                type="text"
                inputMode="decimal"
                placeholder="68"
                value={vitals.weight}
                aria-invalid={weightState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cp-vital-weight-error', showError: weightState.showError })}
                onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                onBlur={() => cpInteraction.markTouched('weight', weightValidation, 'Weight')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 text-center focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(weightState)}`}
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5">kg</span>
              <FieldFeedback id="cp-vital-weight-error" state={weightState} compact />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="cp-vital-spo2" className="block text-[11px] font-bold text-slate-600 mb-1">SpO2 Oxygen</label>
              <input
                id="cp-vital-spo2"
                type="text"
                inputMode="numeric"
                placeholder="99"
                value={vitals.spo2}
                aria-invalid={spo2State.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cp-vital-spo2-error', showError: spo2State.showError })}
                onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                onBlur={() => cpInteraction.markTouched('spo2', spo2Validation, 'SpO2 oxygen saturation')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 text-center focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(spo2State)}`}
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5">%</span>
              <FieldFeedback id="cp-vital-spo2-error" state={spo2State} compact />
            </div>
          </div>
        </div>

        {/* Section 3: Symptoms & Diagnosis */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            3. Complaints & Diagnosis
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cp-symptoms" className="block text-xs font-bold text-slate-700 mb-1">
                Chief Complaints & Symptoms
              </label>
              <textarea
                id="cp-symptoms"
                rows="2"
                placeholder="e.g. Fever with chills x 3 days, dry cough, mild throat pain"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="cp-diagnosis" className="block text-xs font-bold text-slate-700 mb-1">
                Clinical Diagnosis / Impression *
              </label>
              <textarea
                id="cp-diagnosis"
                rows="2"
                required
                placeholder="e.g. Acute Upper Respiratory Tract Infection (URTI) / Viral Fever"
                value={diagnosis}
                aria-invalid={diagnosisState.ariaInvalid}
                aria-describedby={buildDescribedBy({
                  errorId: 'cp-diagnosis-error',
                  showError: diagnosisState.showError
                })}
                onChange={(e) => setDiagnosis(e.target.value)}
                onBlur={() => cpInteraction.markTouched('diagnosis', diagnosisValidation, 'Clinical diagnosis')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(diagnosisState)}`}
              />
              <FieldFeedback id="cp-diagnosis-error" state={diagnosisState} />
            </div>
          </div>
        </div>

        {/* Section 4: Prescribed Medicines (Rx) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-teal-700 flex items-center gap-2">
              <span className="text-base font-serif italic font-bold">Rx</span>
              4. Prescribed Medications
            </h2>

            <button
              type="button"
              onClick={addMedicineRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs border border-teal-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Medicine
            </button>
          </div>

          <div className="space-y-3">
            {medicines.map((med, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>

                {/* Medicine Name */}
                <div className="flex-1 w-full sm:w-auto">
                  <input
                    type="text"
                    required
                    placeholder="Medicine Name (e.g. Tab Dolo 650mg, Syr Ascoril)"
                    value={med.name}
                    aria-invalid={idx === 0 && cpInteraction.submitted && validMedsCount === 0 ? 'true' : 'false'}
                    onChange={(e) => updateMedicineRow(idx, 'name', e.target.value)}
                    className={`w-full px-3 py-2 bg-white border rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 ${
                      idx === 0 && cpInteraction.submitted && validMedsCount === 0
                        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-400'
                        : 'border-slate-200 focus:border-teal-500 focus:ring-teal-500'
                    }`}
                  />
                </div>

                {/* Dosage / Frequency */}
                <div className="w-full sm:w-36">
                  <input
                    type="text"
                    list={`dosages-${idx}`}
                    placeholder="Dose (1-0-1)"
                    value={med.dosage}
                    onChange={(e) => updateMedicineRow(idx, 'dosage', e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-center"
                  />
                  <datalist id={`dosages-${idx}`}>
                    {COMMON_DOSAGES.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>

                {/* Duration */}
                <div className="w-full sm:w-28">
                  <input
                    type="text"
                    list={`durations-${idx}`}
                    placeholder="5 Days"
                    value={med.duration}
                    onChange={(e) => updateMedicineRow(idx, 'duration', e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-center"
                  />
                  <datalist id={`durations-${idx}`}>
                    {COMMON_DURATIONS.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>

                {/* Instructions */}
                <div className="w-full sm:w-36">
                  <input
                    type="text"
                    list={`instructions-${idx}`}
                    placeholder="After Food"
                    value={med.instructions}
                    onChange={(e) => updateMedicineRow(idx, 'instructions', e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                  />
                  <datalist id={`instructions-${idx}`}>
                    {COMMON_INSTRUCTIONS.map(i => <option key={i} value={i} />)}
                  </datalist>
                </div>

                {/* Delete row */}
                {medicines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMedicineRow(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors self-end sm:self-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Doctor's Advice & Next Review */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            5. Physician Advice & Follow-up
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Advice & Precautions</label>
              <input
                type="text"
                placeholder="e.g. Drink warm fluids, avoid cold water, take adequate rest"
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Follow-up Review</label>
              <select
                value={followUpDays}
                onChange={(e) => setFollowUpDays(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
              >
                <option value="3">After 3 Days</option>
                <option value="5">After 5 Days</option>
                <option value="7">After 7 Days (1 Week)</option>
                <option value="15">After 15 Days</option>
                <option value="30">After 1 Month</option>
                <option value="0">SOS / Only if needed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 6: Consultation Fee & Payment */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <label htmlFor="cp-fee" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Consultation Fee
              </label>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-extrabold text-emerald-700">₹</span>
                <input
                  id="cp-fee"
                  type="text"
                  inputMode="decimal"
                  value={consultationFeeRupees}
                  aria-invalid={feeState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    errorId: 'cp-fee-error',
                    showError: feeState.showError
                  })}
                  onChange={(e) => setConsultationFeeRupees(e.target.value)}
                  onBlur={() => cpInteraction.markTouched('consultationFee', feeValidation, 'Consultation fee')}
                  className={`w-28 px-2 py-1 bg-slate-50 border rounded-lg text-base font-bold text-emerald-800 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(feeState)}`}
                />
              </div>
              <FieldFeedback id="cp-fee-error" state={feeState} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Payment Mode:</span>
            {['Cash', 'UPI', 'Pending'].map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMethod(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  paymentMethod === mode
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSaveCasePaper(false)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Case Paper'}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSaveCasePaper(true)}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {isSubmitting ? 'Processing...' : 'Save & Print Case Paper (PDF)'}
          </button>
        </div>
      </form>

      {/* Previous Prescriptions & Camera Capture Modal */}
      {prevRxModalOpen && selectedPatient && (
        <PreviousPrescriptionsModal
          isOpen={prevRxModalOpen}
          onClose={() => {
            setPrevRxModalOpen(false);
            fetchInlinePrevRx(selectedPatient.id);
          }}
          patientId={selectedPatient.id}
          patientName={selectedPatient.fullName}
          onPrescriptionAdded={() => fetchInlinePrevRx(selectedPatient.id)}
        />
      )}
    </div>
  );
};

