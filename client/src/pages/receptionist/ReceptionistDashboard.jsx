import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Clock,
  Receipt,
  UserPlus,
  CheckCircle2,
  Stethoscope,
  Search,
  Plus,
  Camera,
  Upload,
  FileText,
  AlertTriangle,
  RefreshCw,
  X,
  Phone,
  Pill
} from 'lucide-react';
import { api } from '../../services/api.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { calculateAge, formatDate, getLocalDateString, getStatusBadgeStyle } from '../../utils/formatters.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PreviousPrescriptionsModal } from '../../components/prescriptions/PreviousPrescriptionsModal.jsx';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect.jsx';
import {
  validateFullName,
  validateMobile,
  validateAge,
  validateRequiredText,
  validateNotPastDate,
  validateAmount,
  normalizeMobile
} from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

const QUICK_REASONS = [
  'Fever & Cold',
  'Cough & Throat Pain',
  'BP / Sugar Checkup',
  'Body / Joint Pain',
  'Stomach / Acidity',
  'Routine Follow-up'
];

// Find a collision-free HH:mm time slot for walk-in arrivals today
const getAvailableWalkInTimeSlot = (existingAppointments) => {
  const taken = new Set(
    existingAppointments
      .filter(a => a.status !== 'cancelled')
      .map(a => a.timeSlot)
  );
  const now = new Date();
  let totalMinutes = now.getHours() * 60 + now.getMinutes();

  for (let i = 0; i < 120; i++) {
    const mins = (totalMinutes + i) % (24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    const candidate = `${hh}:${mm}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

export const ReceptionistDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [patientsMap, setPatientsMap] = useState({});
  const [prevRxCounts, setPrevRxCounts] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'waiting' | 'scheduled' | 'completed'
  const [isLoading, setIsLoading] = useState(true);

  // Previous Prescriptions Modal
  const [prevRxModalOpen, setPrevRxModalOpen] = useState(false);
  const [selectedPatientForRx, setSelectedPatientForRx] = useState(null);

  // Simple Check-In & Schedule Modal
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [patientMode, setPatientMode] = useState('existing'); // 'existing' | 'new'
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [newPatient, setNewPatient] = useState({
    fullName: '',
    mobileNumber: '',
    age: '',
    gender: 'Male',
    allergies: ''
  });
  const [visitReason, setVisitReason] = useState('');
  const [visitType, setVisitType] = useState('walkin'); // 'walkin' | 'scheduled'
  const [visitDate, setVisitDate] = useState(() => getLocalDateString());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isClosedDay, setIsClosedDay] = useState(false);

  // Optional Previous Rx during check-in
  const [prevRxFile, setPrevRxFile] = useState(null);
  const [prevRxPreviewUrl, setPrevRxPreviewUrl] = useState(null);
  const [prevRxDoctorName, setPrevRxDoctorName] = useState('');
  const [prevRxMedicines, setPrevRxMedicines] = useState('');
  const [isSavingVisit, setIsSavingVisit] = useState(false);

  // Quick Collect Fee Modal
  const [feeModalAppt, setFeeModalAppt] = useState(null);
  const [feeRupees, setFeeRupees] = useState(500);
  const [feeMethod, setFeeMethod] = useState('cash');
  const [isSavingFee, setIsSavingFee] = useState(false);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const bookingFormRef = useRef(null);
  const feeFormRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { clinic } = useAuth();
  const todayStr = getLocalDateString();

  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const bookingValidation = useFormInteraction();
  const feeValidationHook = useFormInteraction();

  // Live computed field validations for booking / check-in modal
  const nameValidation = validateFullName(newPatient.fullName);
  const mobileValidation = validateMobile(newPatient.mobileNumber);
  const ageValidation = validateAge(newPatient.age);
  const reasonValidation = validateRequiredText(visitReason, 'Symptoms / reason for visit', { min: 2, max: 500 });
  const dateValidation = validateNotPastDate(visitDate, {
    required: visitType === 'scheduled',
    label: 'Appointment date'
  });
  const feeValidation = validateAmount(feeRupees, 'Consultation fee', { required: true, min: 0, max: 100000 });

  const nameFieldState = bookingValidation.getFieldState('fullName', nameValidation);
  const mobileFieldState = bookingValidation.getFieldState('mobileNumber', mobileValidation);
  const ageFieldState = bookingValidation.getFieldState('age', ageValidation);
  const reasonFieldState = bookingValidation.getFieldState('visitReason', reasonValidation);
  const dateFieldState = bookingValidation.getFieldState('visitDate', dateValidation);
  const feeFieldState = feeValidationHook.getFieldState('feeRupees', feeValidation);

  useEffect(() => {
    if (!bookingModalOpen || patientMode !== 'new' || !mobileValidation.valid || !mobileValidation.normalized) {
      setDuplicateMatch(null);
      return;
    }
    const timer = setTimeout(() => {
      api.patients.checkDuplicate({ mobileNumber: mobileValidation.normalized })
        .then(res => setDuplicateMatch(res.duplicates?.[0] || null))
        .catch(() => setDuplicateMatch(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [bookingModalOpen, patientMode, mobileValidation.valid, mobileValidation.normalized]);

  useEffect(() => {
    if (clinic?.consultationFee) {
      setFeeRupees(Math.round(clinic.consultationFee / 100));
    }
  }, [clinic]);

  const loadPrevRxCounts = async (queueItems) => {
    const uniqueIds = [...new Set(queueItems.map(a => a.patientId).filter(Boolean))];
    if (uniqueIds.length === 0) {
      setPrevRxCounts({});
      return;
    }

    const results = await Promise.allSettled(
      uniqueIds.map(id => api.documents.getPreviousPrescriptions(id).then(res => [id, res.totalCount || 0]))
    );

    const counts = {};
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        const [id, count] = r.value;
        counts[id] = count;
      }
    });
    setPrevRxCounts(counts);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [apptsData, patRes] = await Promise.all([
        api.appointments.list({ date: todayStr }),
        api.patients.list({ limit: 200 })
      ]);

      const queue = apptsData || [];
      const pats = patRes?.patients || [];
      const pMap = {};
      pats.forEach(p => { pMap[p.id] = p; });

      setAppointments(queue);
      setPatientsList(pats);
      setPatientsMap(pMap);

      loadPrevRxCounts(queue);
    } catch (err) {
      showToast('Failed to load today queue', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load slots when scheduling for a chosen date
  useEffect(() => {
    if (!bookingModalOpen || visitType !== 'scheduled') return;
    api.appointments.getSlots(visitDate)
      .then(res => {
        setIsClosedDay(Boolean(res.isClosed));
        const openSlots = (res.slots || []).filter(s => s.isAvailable);
        setAvailableSlots(openSlots);
        if (openSlots.length > 0 && !openSlots.some(s => s.time === selectedSlot)) {
          setSelectedSlot(openSlots[0].time);
        } else if (openSlots.length === 0) {
          setSelectedSlot('');
        }
      })
      .catch(() => {
        setAvailableSlots([]);
      });
  }, [bookingModalOpen, visitType, visitDate]);

  const resetBookingModal = () => {
    setPatientMode('existing');
    setSelectedPatientId('');
    setNewPatient({ fullName: '', mobileNumber: '', age: '', gender: 'Male', allergies: '' });
    setVisitReason('');
    setVisitType('walkin');
    setVisitDate(todayStr);
    setSelectedSlot('');
    setPrevRxFile(null);
    if (prevRxPreviewUrl) URL.revokeObjectURL(prevRxPreviewUrl);
    setPrevRxPreviewUrl(null);
    setPrevRxDoctorName('');
    setPrevRxMedicines('');
    setDuplicateMatch(null);
    bookingValidation.resetInteraction();
  };

  const openBookingModal = () => {
    resetBookingModal();
    setBookingModalOpen(true);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.appointments.updateStatus(id, status);
      showToast(
        status === 'checked-in' ? 'Patient checked in & sent to Doctor queue' : `Status updated to ${status}`,
        'success'
      );
      loadData();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'error');
    }
  };

  const handlePrevRxFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('File must be under 15 MB', 'warning');
      return;
    }
    if (prevRxPreviewUrl) URL.revokeObjectURL(prevRxPreviewUrl);
    setPrevRxFile(file);
    setPrevRxPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    bookingValidation.setSubmitted(true);

    if (patientMode === 'existing') {
      if (!selectedPatientId) {
        showToast('Please select a patient from the list or switch to New Patient', 'warning');
        focusFirstInvalidField(bookingFormRef.current);
        return;
      }
    } else {
      if (!nameValidation.valid || !mobileValidation.valid || !ageValidation.valid) {
        const firstErr = nameValidation.error || mobileValidation.error || ageValidation.error;
        showToast(firstErr || 'Please fix the highlighted patient details', 'warning');
        focusFirstInvalidField(bookingFormRef.current);
        return;
      }
    }

    if (!reasonValidation.valid) {
      showToast(reasonValidation.error || 'Please enter why the patient came today', 'warning');
      focusFirstInvalidField(bookingFormRef.current);
      return;
    }

    if (visitType === 'scheduled' && !dateValidation.valid) {
      showToast(dateValidation.error || 'Please choose a valid appointment date', 'warning');
      focusFirstInvalidField(bookingFormRef.current);
      return;
    }

    if (visitType === 'scheduled' && !selectedSlot) {
      showToast('Please pick or enter a time slot', 'warning');
      focusFirstInvalidField(bookingFormRef.current);
      return;
    }

    let finalPatientId = selectedPatientId;
    let finalPatientName = '';
    let finalPatientPhone = '';

    if (patientMode === 'existing') {
      const pat = patientsMap[selectedPatientId];
      finalPatientName = pat?.fullName || '';
      finalPatientPhone = pat?.mobileNumber || '';
    }

    setIsSavingVisit(true);
    try {
      // 1. Register new patient if needed
      if (patientMode === 'new') {
        let dob = '';
        if (newPatient.age && Number(newPatient.age) > 0) {
          const birthYear = new Date().getFullYear() - Number(newPatient.age);
          dob = `${birthYear}-01-01`;
        }
        const created = await api.patients.register({
          fullName: newPatient.fullName.trim(),
          mobileNumber: mobileValidation.normalized || normalizeMobile(newPatient.mobileNumber),
          gender: newPatient.gender,
          dateOfBirth: dob,
          allergies: newPatient.allergies.trim()
        });
        finalPatientId = created.id;
        finalPatientName = created.fullName;
        finalPatientPhone = created.mobileNumber;
      }

      // 2. Book appointment (walk-in automatically becomes 'checked-in' for Doctor)
      const isWalkIn = visitType === 'walkin';
      const bookingDate = isWalkIn ? todayStr : visitDate;
      const timeSlot = isWalkIn ? getAvailableWalkInTimeSlot(appointments) : selectedSlot;

      await api.appointments.book({
        patientId: finalPatientId,
        patientName: finalPatientName,
        patientPhone: finalPatientPhone,
        date: bookingDate,
        timeSlot,
        reason: visitReason.trim(),
        isWalkIn,
        status: isWalkIn ? 'checked-in' : 'confirmed'
      });

      // 3. Attach previous prescription photo/PDF or manual notes if provided
      if (prevRxFile) {
        const fd = new FormData();
        fd.append('document', prevRxFile);
        fd.append('patientId', finalPatientId);
        fd.append('category', 'Previous Prescription');
        fd.append('title', prevRxDoctorName ? `Previous Rx - ${prevRxDoctorName}` : 'Previous Prescription Photo');
        fd.append('doctorName', prevRxDoctorName.trim());
        fd.append('prescribedMedicines', prevRxMedicines.trim());
        fd.append('originalDocumentDate', todayStr);
        await api.documents.upload(fd);
      } else if (prevRxMedicines.trim() || prevRxDoctorName.trim()) {
        await api.documents.saveManualPrescription({
          patientId: finalPatientId,
          doctorName: prevRxDoctorName.trim() || 'Previous Clinic / Doctor',
          prescribedMedicines: prevRxMedicines.trim(),
          originalDocumentDate: todayStr,
          title: prevRxDoctorName ? `Previous Rx - ${prevRxDoctorName}` : 'Manual Previous Rx'
        });
      }

      showToast(
        isWalkIn
          ? `${finalPatientName} checked in & sent to Doctor Portal!`
          : `Appointment scheduled for ${finalPatientName} on ${formatDate(bookingDate)} at ${timeSlot}`,
        'success'
      );
      setBookingModalOpen(false);
      resetBookingModal();
      loadData();
    } catch (err) {
      showToast(err.message || 'Could not save visit details', 'error');
    } finally {
      setIsSavingVisit(false);
    }
  };

  const handleCollectFee = async (e) => {
    e.preventDefault();
    feeValidationHook.setSubmitted(true);
    if (!feeModalAppt?.patientId) {
      showToast('Patient record missing for billing', 'error');
      return;
    }

    if (!feeValidation.valid) {
      showToast(feeValidation.error || 'Please enter a valid consultation fee', 'warning');
      focusFirstInvalidField(feeFormRef.current);
      return;
    }

    const amountPaise = Math.round(Number(feeRupees || 0) * 100);
    setIsSavingFee(true);
    try {
      await api.billing.create({
        patientId: feeModalAppt.patientId,
        appointmentId: feeModalAppt.id,
        consultationFee: amountPaise,
        paidAmount: amountPaise,
        paymentMethod: feeMethod,
        notes: feeModalAppt.reason ? `Visit: ${feeModalAppt.reason}` : 'OPD Consultation'
      });
      showToast(`₹${feeRupees} collected via ${feeMethod.toUpperCase()}`, 'success');
      feeValidationHook.resetInteraction();
      setFeeModalAppt(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to record fee', 'error');
    } finally {
      setIsSavingFee(false);
    }
  };

  const waitingCount = appointments.filter(a => a.status === 'checked-in').length;
  const inConsultCount = appointments.filter(a => a.status === 'in-consultation').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  const filteredQueue = appointments.filter(a => {
    if (statusFilter === 'waiting' && a.status !== 'checked-in' && a.status !== 'in-consultation') return false;
    if (statusFilter === 'scheduled' && a.status !== 'confirmed' && a.status !== 'requested') return false;
    if (statusFilter === 'completed' && a.status !== 'completed') return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.patientName || '').toLowerCase().includes(q) ||
      (a.patientPhone || '').includes(q) ||
      (a.reason || '').toLowerCase().includes(q)
    );
  });

  const selectedModalPatient = selectedPatientId ? patientsMap[selectedPatientId] : null;

  return (
    <div className="space-y-6">
      {/* Clean Modern Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full">
            <span>Front Desk</span>
            <span>•</span>
            <span>{formatDate(todayStr)}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Patient Check-in & Appointments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Add patient visit, note why they came, attach previous prescriptions — Doctor sees it immediately.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Refresh Queue"
            aria-label="Refresh queue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openBookingModal}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm shadow-teal-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Patient / Book Visit</span>
          </button>
        </div>
      </div>

      {/* 3 Calm Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Waiting Outside"
          value={waitingCount}
          icon={Clock}
          subtext="Ready in Doctor's queue"
          color="amber"
        />
        <StatCard
          title="Inside Cabin"
          value={inConsultCount}
          icon={Stethoscope}
          subtext="With Doctor right now"
          color="teal"
        />
        <StatCard
          title="Finished Today"
          value={completedCount}
          icon={CheckCircle2}
          subtext="Completed consultations"
          color="emerald"
        />
      </div>

      {/* Today's Queue */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: `All Today (${appointments.length})` },
              { key: 'waiting', label: `With / Waiting (${waitingCount + inConsultCount})` },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'completed', label: 'Done' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${statusFilter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              placeholder="Search name, phone or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner message="Loading today's patients..." />
        ) : filteredQueue.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No patients match this view"
            description="Click '+ Add Patient / Book Visit' to check in a walk-in or schedule today's appointment."
            actionText="Add Patient / Book Visit"
            onAction={openBookingModal}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQueue.map(item => {
              const pat = item.patientId ? patientsMap[item.patientId] : null;
              const age = pat?.dateOfBirth ? calculateAge(pat.dateOfBirth) : null;
              const rxCount = item.patientId ? (prevRxCounts[item.patientId] || 0) : 0;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Time + Patient + Why He Came */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-center shrink-0 min-w-[76px]">
                      <div className="text-sm font-extrabold text-slate-900">{item.timeSlot}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {item.isWalkIn ? 'Walk-in' : 'Booked'}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.patientId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/receptionist/patients/${item.patientId}`)}
                            className="text-base font-extrabold text-slate-900 hover:text-teal-700 hover:underline text-left"
                          >
                            {item.patientName}
                          </button>
                        ) : (
                          <span className="text-base font-extrabold text-slate-900">{item.patientName}</span>
                        )}

                        {pat && (
                          <span className="text-xs font-semibold text-slate-500">
                            {age ? `${age} Yrs • ` : ''}{pat.gender}
                          </span>
                        )}

                        {item.patientPhone && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <Phone className="w-3 h-3" />
                            {item.patientPhone}
                          </span>
                        )}

                        {pat?.allergies && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Allergy: {pat.allergies}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-700">
                        <span className="font-bold text-slate-900">Why came: </span>
                        <span>{item.reason || 'General Checkup'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Prev Rx Camera Button + Status + 1-Click Action */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {item.patientId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientForRx({ id: item.patientId, name: item.patientName });
                          setPrevRxModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-teal-600" />
                        <span>{rxCount > 0 ? `Old Rx (${rxCount})` : '+ Old Rx Photo'}</span>
                      </button>
                    )}

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border capitalize ${getStatusBadgeStyle(item.status)}`}>
                      {item.status === 'checked-in' && <Clock className="w-3.5 h-3.5" />}
                      {item.status === 'in-consultation' && <Stethoscope className="w-3.5 h-3.5" />}
                      {item.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{item.status === 'checked-in' ? 'Waiting for Doctor' : item.status.replace('-', ' ')}</span>
                    </span>

                    {item.status === 'requested' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item.id, 'confirmed')}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors"
                      >
                        Confirm Visit
                      </button>
                    )}

                    {item.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item.id, 'checked-in')}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors"
                      >
                        Check In → Doctor
                      </button>
                    )}

                    {item.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => {
                          feeValidationHook.resetInteraction();
                          setFeeModalAppt(item);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Collect Fee</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unified Simple Check-In & Schedule Modal */}
      <Modal
        isOpen={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          resetBookingModal();
        }}
        title="Add Patient & Schedule Visit"
        subtitle="Everything you save here appears immediately on the Doctor Portal."
        maxWidth="max-w-2xl"
      >
        <form ref={bookingFormRef} noValidate onSubmit={handleBookingSubmit} className="space-y-5">
          {/* Step 1: Patient Switch */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                1. Select Patient
              </span>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPatientMode('existing')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${patientMode === 'existing' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                >
                  Existing Patient
                </button>
                <button
                  type="button"
                  onClick={() => setPatientMode('new')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${patientMode === 'new' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
                    }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  New Patient
                </button>
              </div>
            </div>

            {patientMode === 'existing' ? (
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <PatientSearchSelect
                  patients={patientsList}
                  value={selectedPatientId}
                  onChange={(id) => setSelectedPatientId(id)}
                  label="Select Patient"
                  required
                  invalid={bookingValidation.submitted && !selectedPatientId}
                  error={
                    bookingValidation.submitted && !selectedPatientId
                      ? 'Please select a patient from the directory or switch to New Patient.'
                      : ''
                  }
                />

                {selectedModalPatient && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 pt-1">
                    <span>
                      <strong>Age/Gender:</strong> {calculateAge(selectedModalPatient.dateOfBirth) || 'N/A'} Yrs • {selectedModalPatient.gender}
                    </span>
                    {selectedModalPatient.bloodGroup && (
                      <span><strong>Blood:</strong> {selectedModalPatient.bloodGroup}</span>
                    )}
                    {selectedModalPatient.allergies && (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-100/70 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" />
                        {selectedModalPatient.allergies}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="sm:col-span-2">
                  <label htmlFor="rd-new-fullname" className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="rd-new-fullname"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="e.g. Suresh Patil"
                    value={newPatient.fullName}
                    aria-invalid={nameFieldState.ariaInvalid}
                    aria-describedby={buildDescribedBy({
                      errorId: 'rd-new-fullname-error',
                      showError: nameFieldState.showError
                    })}
                    onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })}
                    onBlur={() => bookingValidation.markTouched('fullName', nameValidation, 'Full name')}
                    className={`w-full px-3 py-2 bg-white border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(nameFieldState)}`}
                  />
                  <FieldFeedback id="rd-new-fullname-error" state={nameFieldState} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="rd-new-mobile" className="block text-xs font-bold text-slate-700 mb-0.5">
                    Mobile Number *
                  </label>
                  <p id="rd-new-mobile-hint" className="text-[11px] text-slate-500 mb-1">
                    10-digit Indian mobile starting with 6–9 (e.g. 9822012345)
                  </p>
                  <input
                    id="rd-new-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={14}
                    required
                    placeholder="9822012345"
                    value={newPatient.mobileNumber}
                    aria-invalid={mobileFieldState.ariaInvalid}
                    aria-describedby={buildDescribedBy({
                      hintId: 'rd-new-mobile-hint',
                      errorId: 'rd-new-mobile-error',
                      showError: mobileFieldState.showError
                    })}
                    onChange={(e) => setNewPatient({ ...newPatient, mobileNumber: e.target.value })}
                    onBlur={() => bookingValidation.markTouched('mobileNumber', mobileValidation, 'Mobile number')}
                    className={`w-full px-3 py-2 bg-white border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(mobileFieldState)}`}
                  />
                  <FieldFeedback id="rd-new-mobile-error" state={mobileFieldState} />
                </div>

                {duplicateMatch && (
                  <div className="sm:col-span-4 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
                    <span className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Already registered: <strong>{duplicateMatch.fullName}</strong> ({duplicateMatch.patientId})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPatientMode('existing');
                        setSelectedPatientId(duplicateMatch.id);
                        setDuplicateMatch(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors"
                    >
                      Select Existing Patient
                    </button>
                  </div>
                )}

                <div>
                  <label htmlFor="rd-new-age" className="block text-xs font-bold text-slate-700 mb-1">Age (Yrs)</label>
                  <input
                    id="rd-new-age"
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    placeholder="e.g. 34"
                    value={newPatient.age}
                    aria-invalid={ageFieldState.ariaInvalid}
                    aria-describedby={buildDescribedBy({
                      errorId: 'rd-new-age-error',
                      showError: ageFieldState.showError
                    })}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    onBlur={() => bookingValidation.markTouched('age', ageValidation, 'Age')}
                    className={`w-full px-3 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(ageFieldState)}`}
                  />
                  <FieldFeedback id="rd-new-age-error" state={ageFieldState} />
                </div>
                <div>
                  <label htmlFor="rd-new-gender" className="block text-xs font-bold text-slate-700 mb-1">Gender *</label>
                  <select
                    id="rd-new-gender"
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="rd-new-allergies" className="block text-xs font-bold text-slate-700 mb-1">Allergies (if any)</label>
                  <input
                    id="rd-new-allergies"
                    type="text"
                    placeholder="e.g. Penicillin, Sulfa (or leave blank)"
                    value={newPatient.allergies}
                    onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Why Did The Patient Come & Schedule */}
          <div className="space-y-3">
            <label htmlFor="rd-visit-reason" className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
              2. Why did the patient come? (Symptoms / Reason) *
            </label>
            <input
              id="rd-visit-reason"
              type="text"
              required
              placeholder="e.g. High fever since 2 days, headache and cough"
              value={visitReason}
              aria-invalid={reasonFieldState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'rd-visit-reason-error',
                showError: reasonFieldState.showError
              })}
              onChange={(e) => setVisitReason(e.target.value)}
              onBlur={() => bookingValidation.markTouched('visitReason', reasonValidation, 'Symptoms / reason for visit')}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                reasonFieldState,
                'border-slate-300 focus:border-teal-500 focus:ring-teal-500'
              )}`}
            />
            <FieldFeedback id="rd-visit-reason-error" state={reasonFieldState} />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setVisitReason(r)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 border border-slate-200 transition-colors"
                >
                  + {r}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setVisitType('walkin')}
                className={`p-3 rounded-xl border text-left transition-all ${visitType === 'walkin'
                  ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <div className="text-xs font-extrabold text-slate-900">Walk-in Now</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Send straight to Doctor queue</div>
              </button>
              <button
                type="button"
                onClick={() => setVisitType('scheduled')}
                className={`p-3 rounded-xl border text-left transition-all ${visitType === 'scheduled'
                  ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <div className="text-xs font-extrabold text-slate-900">Schedule Time Slot</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Pick date & appointment time</div>
              </button>
            </div>

            {visitType === 'scheduled' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label htmlFor="rd-visit-date" className="block text-xs font-bold text-slate-700 mb-1">
                    Appointment Date
                  </label>
                  <input
                    id="rd-visit-date"
                    type="date"
                    value={visitDate}
                    min={todayStr}
                    aria-invalid={dateFieldState.ariaInvalid}
                    aria-describedby={buildDescribedBy({
                      errorId: 'rd-visit-date-error',
                      showError: dateFieldState.showError
                    })}
                    onChange={(e) => setVisitDate(e.target.value)}
                    onBlur={() => bookingValidation.markTouched('visitDate', dateValidation, 'Appointment date')}
                    className={`w-full px-3 py-2 bg-white border rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(dateFieldState)}`}
                  />
                  <FieldFeedback id="rd-visit-date-error" state={dateFieldState} />
                </div>
                <div>
                  <label htmlFor="rd-visit-slot" className="block text-xs font-bold text-slate-700 mb-1">
                    Time Slot
                  </label>
                  {availableSlots.length > 0 && !isClosedDay ? (
                    <select
                      id="rd-visit-slot"
                      value={selectedSlot}
                      onChange={(e) => setSelectedSlot(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                    >
                      {availableSlots.map(s => (
                        <option key={s.time} value={s.time}>{s.time}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="rd-visit-slot"
                      type="time"
                      required
                      value={selectedSlot}
                      aria-invalid={bookingValidation.submitted && !selectedSlot ? 'true' : 'false'}
                      onChange={(e) => setSelectedSlot(e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 ${bookingValidation.submitted && !selectedSlot
                        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-400'
                        : 'border-slate-200 focus:border-teal-500 focus:ring-teal-500'
                        }`}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Optional Previous Prescriptions (Camera OR Manual) */}
          <div className="space-y-3 p-4 rounded-xl bg-teal-50/40 border border-teal-200/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-teal-600" />
                3. Previous Prescription (Optional)
              </span>

              <div className="flex items-center gap-2">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePrevRxFileSelect}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handlePrevRxFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-teal-600" />
                  Upload File
                </button>
              </div>
            </div>

            {prevRxFile && (
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-teal-200">
                <div className="flex items-center gap-3 min-w-0">
                  {prevRxPreviewUrl ? (
                    <img src={prevRxPreviewUrl} alt="Captured Rx" className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-teal-700" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{prevRxFile.name}</p>
                    <p className="text-[11px] text-teal-700 font-semibold">Photo/PDF ready to attach for Doctor</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (prevRxPreviewUrl) URL.revokeObjectURL(prevRxPreviewUrl);
                    setPrevRxFile(null);
                    setPrevRxPreviewUrl(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                  aria-label="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Prev Doctor / Hospital (optional)"
                value={prevRxDoctorName}
                onChange={(e) => setPrevRxDoctorName(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
              />
              <input
                type="text"
                placeholder="Type old medicines manually (e.g. Tab Azithral 500mg, Paracetamol)"
                value={prevRxMedicines}
                onChange={(e) => setPrevRxMedicines(e.target.value)}
                className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBookingModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingVisit}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
            >
              {isSavingVisit
                ? 'Saving...'
                : visitType === 'walkin'
                  ? 'Check In & Send to Doctor'
                  : 'Save & Schedule Appointment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick 1-Click Collect Fee Modal */}
      <Modal
        isOpen={Boolean(feeModalAppt)}
        onClose={() => {
          feeValidationHook.resetInteraction();
          setFeeModalAppt(null);
        }}
        title="Collect Consultation Fee"
        subtitle={feeModalAppt ? `${feeModalAppt.patientName} • ${feeModalAppt.reason || 'OPD Visit'}` : ''}
        maxWidth="max-w-md"
      >
        <form ref={feeFormRef} noValidate onSubmit={handleCollectFee} className="space-y-4">
          <div>
            <label htmlFor="rd-fee-rupees" className="block text-xs font-bold text-slate-700 mb-1">
              Consultation Fee (₹) *
            </label>
            <input
              id="rd-fee-rupees"
              type="text"
              inputMode="decimal"
              required
              value={feeRupees}
              aria-invalid={feeFieldState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'rd-fee-rupees-error',
                showError: feeFieldState.showError
              })}
              onChange={(e) => setFeeRupees(e.target.value)}
              onBlur={() => feeValidationHook.markTouched('feeRupees', feeValidation, 'Consultation fee')}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-lg font-extrabold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(feeFieldState)}`}
            />
            <FieldFeedback id="rd-fee-rupees-error" state={feeFieldState} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'cash', label: 'Cash' },
                { key: 'upi', label: 'UPI / QR' },
                { key: 'card', label: 'Card' }
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setFeeMethod(m.key)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${feeMethod === m.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                feeValidationHook.resetInteraction();
                setFeeModalAppt(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingFee}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {isSavingFee ? 'Saving...' : `Record ₹${feeRupees} Payment`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Previous Prescriptions & Camera Modal */}
      {prevRxModalOpen && selectedPatientForRx && (
        <PreviousPrescriptionsModal
          isOpen={prevRxModalOpen}
          onClose={() => {
            setPrevRxModalOpen(false);
            setSelectedPatientForRx(null);
            loadData();
          }}
          patientId={selectedPatientForRx.id}
          patientName={selectedPatientForRx.name}
          onPrescriptionAdded={() => loadData()}
        />
      )}
    </div>
  );
};
