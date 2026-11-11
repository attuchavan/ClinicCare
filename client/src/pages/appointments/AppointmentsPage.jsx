import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  UserPlus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  AlertCircle,
  Camera,
  FileText
} from 'lucide-react';
import { api } from '../../services/api.js';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { formatDate, getStatusBadgeStyle } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PreviousPrescriptionsModal } from '../../components/prescriptions/PreviousPrescriptionsModal.jsx';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect.jsx';
import {
  validateFullName,
  validateMobile,
  validateNotPastDate,
  normalizeMobile
} from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

export const AppointmentsPage = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Previous Prescriptions Modal State
  const [prevRxModalOpen, setPrevRxModalOpen] = useState(false);
  const [selectedPatientForRx, setSelectedPatientForRx] = useState(null);

  // Booking Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [patientsList, setPatientsList] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Reschedule Modal
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);

  const bookFormRef = useRef(null);
  const bookInteraction = useFormInteraction();

  const walkInNameValidation = validateFullName(walkInName, { label: 'Walk-in patient name' });
  const walkInPhoneValidation = validateMobile(walkInPhone);
  const bookingDateValidation = validateNotPastDate(bookingDate, { required: true, label: 'Appointment date' });

  const walkInNameState = bookInteraction.getFieldState('walkInName', walkInNameValidation);
  const walkInPhoneState = bookInteraction.getFieldState('walkInPhone', walkInPhoneValidation);
  const bookingDateState = bookInteraction.getFieldState('bookingDate', bookingDateValidation);

  const { role } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'book') {
      bookInteraction.resetInteraction();
      setIsBookModalOpen(true);
    }
  }, [searchParams]);

  const loadAppointments = async () => {
    setIsLoading(true);
    try {
      const data = await api.appointments.list({
        date: selectedDate,
        ...(statusFilter !== 'all' && { status: statusFilter })
      });
      setAppointments(data || []);
    } catch (err) {
      showToast('Failed to load appointments', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [selectedDate, statusFilter]);

  // Load patients list for appointment dropdown
  useEffect(() => {
    if (isBookModalOpen) {
      api.patients.list({ limit: 500 })
        .then(res => setPatientsList(res.patients || []))
        .catch(err => console.error(err));
    }
  }, [isBookModalOpen]);

  // Load slots when booking date changes
  useEffect(() => {
    if (!bookingDate) return;
    api.appointments.getSlots(bookingDate)
      .then(res => setAvailableSlots(res.slots || []))
      .catch(err => console.error(err));
  }, [bookingDate]);

  // Load slots when reschedule date changes
  useEffect(() => {
    if (!rescheduleDate) return;
    api.appointments.getSlots(rescheduleDate)
      .then(res => setRescheduleSlots(res.slots || []))
      .catch(err => console.error(err));
  }, [rescheduleDate]);

  const handleDateShift = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.appointments.updateStatus(id, status);
      showToast(`Appointment marked as ${status}`, 'success');
      loadAppointments();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'error');
    }
  };

  const handleOpenPrevRx = (patientId, patientName) => {
    setSelectedPatientForRx({ id: patientId, name: patientName });
    setPrevRxModalOpen(true);
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    bookInteraction.setSubmitted(true);

    if (!isWalkIn && !selectedPatientId) {
      showToast('Please select a patient', 'warning');
      focusFirstInvalidField(bookFormRef.current);
      return;
    }

    if (isWalkIn && (!walkInNameValidation.valid || !walkInPhoneValidation.valid)) {
      const firstErr = walkInNameValidation.error || walkInPhoneValidation.error;
      showToast(firstErr || 'Please fix the highlighted walk-in patient fields', 'warning');
      focusFirstInvalidField(bookFormRef.current);
      return;
    }

    if (!bookingDateValidation.valid) {
      showToast(bookingDateValidation.error || 'Please choose a valid appointment date', 'warning');
      focusFirstInvalidField(bookFormRef.current);
      return;
    }

    if (!bookingSlot) {
      showToast('Please select a time slot', 'warning');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      let patientName = walkInName.trim();
      let patientPhone = walkInPhoneValidation.normalized || normalizeMobile(walkInPhone);
      if (selectedPatientId) {
        const found = patientsList.find(p => p.id === selectedPatientId);
        if (found) {
          patientName = found.fullName;
          patientPhone = found.mobileNumber;
        }
      }

      await api.appointments.book({
        patientId: isWalkIn ? null : (selectedPatientId || null),
        patientName,
        patientPhone,
        date: bookingDate,
        timeSlot: bookingSlot,
        reason: bookingReason.trim(),
        isWalkIn
      });

      showToast('Appointment booked successfully!', 'success');
      setIsBookModalOpen(false);
      setSelectedPatientId('');
      setWalkInName('');
      setWalkInPhone('');
      setBookingReason('');
      setBookingSlot('');
      setIsWalkIn(false);
      bookInteraction.resetInteraction();
      setSelectedDate(bookingDate);
      loadAppointments();
    } catch (err) {
      showToast(err.message || 'Failed to book appointment', 'error');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleSlot) {
      showToast('Please pick a new time slot', 'warning');
      return;
    }
    try {
      await api.appointments.reschedule(rescheduleTarget.id, {
        date: rescheduleDate,
        timeSlot: rescheduleSlot
      });
      showToast('Appointment rescheduled successfully!', 'success');
      setIsRescheduleModalOpen(false);
      setRescheduleTarget(null);
      loadAppointments();
    } catch (err) {
      showToast(err.message || 'Failed to reschedule', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Appointments & Calendar</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage daily schedule, online patient requests, and walk-in tokens.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            bookInteraction.resetInteraction();
            setIsBookModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Book Appointment
        </button>
      </div>

      {/* Date Navigator & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => handleDateShift(-1)}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
          />

          <button
            type="button"
            onClick={() => handleDateShift(1)}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold transition-colors ml-2"
          >
            Today
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-1 text-xs w-full md:w-auto">
          {['all', 'requested', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg capitalize font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment Schedule List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Loading appointment schedule..." />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="No appointments scheduled"
            description={`No consultation appointments found for ${formatDate(selectedDate)}.`}
            actionText="Book an Appointment"
            onAction={() => setIsBookModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Time Slot</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {a.timeSlot}
                      </div>
                      {a.isWalkIn && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          Walk-in
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {a.patientName}
                      {a.patientId && (
                        <button
                          type="button"
                          onClick={() => navigate(`/${role}/patients/${a.patientId}`)}
                          className="block text-xs font-semibold text-brand-600 hover:underline"
                        >
                          View Profile →
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap font-medium">
                      {a.patientPhone || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs max-w-xs truncate">
                      {a.reason || 'General Checkup'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border capitalize ${getStatusBadgeStyle(a.status)}`}>
                        {a.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                      {/* Previous Prescriptions & Camera Button */}
                      {a.patientId && (
                        <button
                          type="button"
                          onClick={() => handleOpenPrevRx(a.patientId, a.patientName)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
                          title="View or upload past prescriptions & photos"
                        >
                          <Camera className="w-3.5 h-3.5 text-teal-600" />
                          <span>Prev Rx</span>
                        </button>
                      )}

                      {/* Doctor start consultation */}
                      {role === 'doctor' && (a.status === 'checked-in' || a.status === 'in-consultation') && (
                        <button
                          type="button"
                          onClick={() => {
                            api.appointments.updateStatus(a.id, 'in-consultation');
                            navigate(`/doctor/case-paper?patientId=${a.patientId || ''}&appointmentId=${a.id}&name=${encodeURIComponent(a.patientName)}`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Case Paper
                        </button>
                      )}

                      {/* Check-in button */}
                      {a.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(a.id, 'checked-in')}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200"
                        >
                          Check In
                        </button>
                      )}

                      {/* Accept requested booking */}
                      {a.status === 'requested' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(a.id, 'confirmed')}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                        >
                          Confirm
                        </button>
                      )}

                      {/* Reschedule */}
                      {a.status !== 'completed' && a.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleTarget(a);
                            setRescheduleDate(a.date);
                            setIsRescheduleModalOpen(true);
                          }}
                          title="Reschedule appointment"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Cancel */}
                      {a.status !== 'completed' && a.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Cancel this appointment?')) {
                              handleUpdateStatus(a.id, 'cancelled');
                            }
                          }}
                          title="Cancel appointment"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => {
          setIsBookModalOpen(false);
          bookInteraction.resetInteraction();
        }}
        title="Schedule Clinical Appointment"
        maxWidth="max-w-2xl"
      >
        <form ref={bookFormRef} noValidate onSubmit={handleBookSubmit} className="space-y-4">
          {/* Walk-in vs Existing patient toggle */}
          <div className="flex gap-4 p-2 bg-slate-100 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="radio"
                name="bookingType"
                checked={!isWalkIn}
                onChange={() => setIsWalkIn(false)}
              />
              Registered Patient
            </label>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="radio"
                name="bookingType"
                checked={isWalkIn}
                onChange={() => setIsWalkIn(true)}
              />
              Walk-in Patient
            </label>
          </div>

          {!isWalkIn ? (
            <div>
              <PatientSearchSelect
                patients={patientsList}
                value={selectedPatientId}
                onChange={(id) => setSelectedPatientId(id)}
                label="Select Patient"
                required
                invalid={bookInteraction.submitted && !selectedPatientId}
                error={bookInteraction.submitted && !selectedPatientId ? 'Please select a patient from the directory.' : ''}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ap-walkin-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Walk-in Patient Name *
                </label>
                <input
                  id="ap-walkin-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Anand Joshi"
                  value={walkInName}
                  aria-invalid={walkInNameState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    errorId: 'ap-walkin-name-error',
                    showError: walkInNameState.showError
                  })}
                  onChange={(e) => setWalkInName(e.target.value)}
                  onBlur={() => bookInteraction.markTouched('walkInName', walkInNameValidation, 'Walk-in patient name')}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(walkInNameState)}`}
                />
                <FieldFeedback id="ap-walkin-name-error" state={walkInNameState} />
              </div>
              <div>
                <label htmlFor="ap-walkin-phone" className="block text-xs font-bold text-slate-700 uppercase mb-0.5">
                  Mobile Number *
                </label>
                <p id="ap-walkin-phone-hint" className="text-[11px] text-slate-500 mb-1">
                  10-digit Indian mobile (6–9 start)
                </p>
                <input
                  id="ap-walkin-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={14}
                  required
                  placeholder="9876543210"
                  value={walkInPhone}
                  aria-invalid={walkInPhoneState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    hintId: 'ap-walkin-phone-hint',
                    errorId: 'ap-walkin-phone-error',
                    showError: walkInPhoneState.showError
                  })}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  onBlur={() => bookInteraction.markTouched('walkInPhone', walkInPhoneValidation, 'Mobile number')}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(walkInPhoneState)}`}
                />
                <FieldFeedback id="ap-walkin-phone-error" state={walkInPhoneState} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ap-booking-date" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Date *
              </label>
              <input
                id="ap-booking-date"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={bookingDate}
                aria-invalid={bookingDateState.ariaInvalid}
                aria-describedby={buildDescribedBy({
                  errorId: 'ap-booking-date-error',
                  showError: bookingDateState.showError
                })}
                onChange={(e) => setBookingDate(e.target.value)}
                onBlur={() => bookInteraction.markTouched('bookingDate', bookingDateValidation, 'Appointment date')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(bookingDateState)}`}
              />
              <FieldFeedback id="ap-booking-date-error" state={bookingDateState} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Time Slot *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-lg">
                {availableSlots.length === 0 ? (
                  <span className="col-span-4 text-xs text-slate-400 p-2">No slots on this date</span>
                ) : (
                  availableSlots.map(s => (
                    <button
                      type="button"
                      key={s.time}
                      disabled={!s.isAvailable}
                      onClick={() => setBookingSlot(s.time)}
                      className={`py-1.5 px-2 text-xs font-bold rounded ${
                        bookingSlot === s.time
                          ? 'bg-brand-600 text-white'
                          : s.isAvailable
                          ? 'bg-white border hover:bg-brand-50 text-slate-700'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      {s.time}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="ap-booking-reason" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Reason / Symptoms
            </label>
            <input
              id="ap-booking-reason"
              type="text"
              placeholder="e.g. Follow-up checkup, Cough, Blood pressure check"
              value={bookingReason}
              onChange={(e) => setBookingReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsBookModalOpen(false);
                bookInteraction.resetInteraction();
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingBooking}
              className="px-5 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmittingBooking ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        title="Reschedule Appointment"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4">
          <p className="text-xs text-slate-600">
            Rescheduling for: <strong className="text-slate-800">{rescheduleTarget?.patientName}</strong>
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              New Date *
            </label>
            <input
              type="date"
              required
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Pick New Available Slot *
            </label>
            <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-lg">
              {rescheduleSlots.map(s => (
                <button
                  type="button"
                  key={s.time}
                  disabled={!s.isAvailable}
                  onClick={() => setRescheduleSlot(s.time)}
                  className={`py-1.5 px-2 text-xs font-bold rounded ${
                    rescheduleSlot === s.time
                      ? 'bg-brand-600 text-white'
                      : s.isAvailable
                      ? 'bg-white border hover:bg-brand-50 text-slate-700'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRescheduleModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!rescheduleSlot}
              className="px-5 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              Confirm Reschedule
            </button>
          </div>
        </form>
      </Modal>

      {/* Previous Prescriptions & Camera Capture Modal */}
      {prevRxModalOpen && selectedPatientForRx && (
        <PreviousPrescriptionsModal
          isOpen={prevRxModalOpen}
          onClose={() => {
            setPrevRxModalOpen(false);
            setSelectedPatientForRx(null);
          }}
          patientId={selectedPatientForRx.id}
          patientName={selectedPatientForRx.name}
        />
      )}
    </div>
  );
};

