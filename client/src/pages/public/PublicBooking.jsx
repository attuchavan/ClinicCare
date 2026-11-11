import React, { useState, useEffect, useRef } from 'react';
import { Activity, Calendar, Clock, User, Phone, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { formatDate } from '../../utils/formatters.js';
import {
  validateFullName,
  validateMobile,
  validateAge,
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

export const PublicBooking = () => {
  const [clinic, setClinic] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Tomorrow or today formatted YYYY-MM-DD
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [reason, setReason] = useState('');

  const formRef = useRef(null);
  const interaction = useFormInteraction();

  const dateValidation = validateNotPastDate(selectedDate, { required: true, label: 'Consultation date' });
  const nameValidation = validateFullName(fullName);
  const mobileValidation = validateMobile(mobileNumber);
  const ageValidation = validateAge(age);

  const dateFieldState = interaction.getFieldState('selectedDate', dateValidation);
  const nameFieldState = interaction.getFieldState('fullName', nameValidation);
  const mobileFieldState = interaction.getFieldState('mobileNumber', mobileValidation);
  const ageFieldState = interaction.getFieldState('age', ageValidation);

  // Load clinic details
  useEffect(() => {
    api.clinic.get()
      .then(data => setClinic(data))
      .catch(err => console.error('Error loading clinic:', err));
  }, []);

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setIsLoadingSlots(true);
    setSelectedSlot('');
    setErrorMessage('');

    api.appointments.getSlots(selectedDate)
      .then(res => {
        setSlots(res.slots || []);
        if (res.isClosed) {
          setErrorMessage('The clinic is closed on this day. Please select another date.');
        }
      })
      .catch(err => {
        setErrorMessage('Failed to fetch available time slots.');
      })
      .finally(() => setIsLoadingSlots(false));
  }, [selectedDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    interaction.setSubmitted(true);
    setErrorMessage('');

    if (!dateValidation.valid) {
      setErrorMessage(dateValidation.error || 'Please choose a valid consultation date.');
      focusFirstInvalidField(formRef.current);
      return;
    }

    if (!selectedSlot) {
      setErrorMessage('Please select a preferred consultation time slot.');
      return;
    }

    if (!nameValidation.valid || !mobileValidation.valid || !ageValidation.valid) {
      setErrorMessage(nameValidation.error || mobileValidation.error || ageValidation.error || 'Please fix the highlighted fields.');
      focusFirstInvalidField(formRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedPhone = mobileValidation.normalized || normalizeMobile(mobileNumber);
      const res = await api.appointments.publicBook({
        fullName: fullName.trim(),
        mobileNumber: normalizedPhone,
        age,
        gender,
        date: selectedDate,
        timeSlot: selectedSlot,
        reason: reason.trim()
      });
      setBookingSuccess(res);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit appointment request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    setBookingSuccess(null);
    setFullName('');
    setMobileNumber('');
    setAge('');
    setReason('');
    setSelectedSlot('');
    setErrorMessage('');
    interaction.resetInteraction();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Clinic Branding Header */}
      <header className="bg-navy-900 text-white py-6 px-4 sm:px-8 border-b border-navy-800">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="p-3 bg-teal-600 rounded-2xl shadow-md text-white">
              <Activity className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {clinic?.name || 'City Care Family Clinic'}
              </h1>
              <p className="text-xs sm:text-sm text-teal-300">
                {clinic?.doctorName || 'Dr. Rajesh Sharma, M.D.'} • General Physician
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-300 hidden sm:block">
            <p className="font-semibold">{clinic?.phone || '+91 98765 43210'}</p>
            <p className="text-slate-400 max-w-xs truncate">{clinic?.address || 'Station Road, Pune'}</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {bookingSuccess ? (
          /* Confirmation Screen */
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-200/80 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Appointment Requested!</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Thank you, <span className="font-semibold text-slate-800">{fullName}</span>. Your appointment request has been submitted to the clinic.
            </p>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left space-y-3 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Booking Ref:</span>
                <span className="font-mono font-bold text-brand-600">#{bookingSuccess.bookingId?.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Consultation Date:</span>
                <span className="font-bold text-slate-800">{formatDate(bookingSuccess.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Time Slot:</span>
                <span className="font-bold text-teal-700">{bookingSuccess.timeSlot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Doctor:</span>
                <span className="font-semibold text-slate-800">{clinic?.doctorName || 'Dr. Rajesh Sharma'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                  {bookingSuccess.status}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-6">
              The clinic reception will verify and send an SMS/WhatsApp reminder to {mobileNumber}.
            </p>

            <button
              type="button"
              onClick={handleBookAnother}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-bold text-sm shadow-md hover:bg-brand-700 transition-colors"
            >
              Book Another Appointment
            </button>
          </div>
        ) : (
          /* Booking Form */
          <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200/80">
            <div className="border-b border-slate-100 pb-5 mb-8">
              <h2 className="text-2xl font-bold text-navy-900">Book Doctor Consultation</h2>
              <p className="text-sm text-slate-500 mt-1">
                Select your preferred date and slot to reserve a clinical consultation with Dr. Rajesh Sharma.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-8">
              {/* Step 1: Select Date & Time Slot */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-700 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> 1. Select Date & Time
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div className="sm:col-span-1">
                    <label htmlFor="pb-date" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      Consultation Date *
                    </label>
                    <input
                      id="pb-date"
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={selectedDate}
                      aria-invalid={dateFieldState.ariaInvalid}
                      aria-describedby={buildDescribedBy({
                        errorId: 'pb-date-error',
                        showError: dateFieldState.showError
                      })}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      onBlur={() => interaction.markTouched('selectedDate', dateValidation, 'Consultation date')}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                        dateFieldState,
                        'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
                      )}`}
                    />
                    <FieldFeedback id="pb-date-error" state={dateFieldState} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      Available Slots ({formatDate(selectedDate)})
                    </label>
                    {isLoadingSlots ? (
                      <p className="text-xs text-slate-500 py-3">Fetching clinic slots...</p>
                    ) : slots.length === 0 ? (
                      <p className="text-xs text-rose-500 py-3 font-medium">No consultation slots available on this date.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                        {slots.map(slot => (
                          <button
                            type="button"
                            key={slot.time}
                            disabled={!slot.isAvailable}
                            onClick={() => setSelectedSlot(slot.time)}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${selectedSlot === slot.time
                              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                              : slot.isAvailable
                                ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-brand-50 hover:border-brand-300'
                                : 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed opacity-60'
                              }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Patient Information */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-700 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" /> 2. Patient Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pb-fullname" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      Full Name *
                    </label>
                    <input
                      id="pb-fullname"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Ramesh Kulkarni"
                      value={fullName}
                      aria-invalid={nameFieldState.ariaInvalid}
                      aria-describedby={buildDescribedBy({
                        errorId: 'pb-fullname-error',
                        showError: nameFieldState.showError
                      })}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => interaction.markTouched('fullName', nameValidation, 'Full name')}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                        nameFieldState,
                        'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
                      )}`}
                    />
                    <FieldFeedback id="pb-fullname-error" state={nameFieldState} />
                  </div>

                  <div>
                    <label htmlFor="pb-mobile" className="block text-xs font-bold text-slate-600 uppercase mb-0.5">
                      Mobile Number (For WhatsApp / SMS Confirmation) *
                    </label>
                    <p id="pb-mobile-hint" className="text-[11px] text-slate-500 mb-1.5">
                      10-digit Indian mobile starting with 6–9 (e.g. 9822012345)
                    </p>
                    <input
                      id="pb-mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={14}
                      required
                      placeholder="9822012345"
                      value={mobileNumber}
                      aria-invalid={mobileFieldState.ariaInvalid}
                      aria-describedby={buildDescribedBy({
                        hintId: 'pb-mobile-hint',
                        errorId: 'pb-mobile-error',
                        showError: mobileFieldState.showError
                      })}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      onBlur={() => interaction.markTouched('mobileNumber', mobileValidation, 'Mobile number')}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                        mobileFieldState,
                        'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
                      )}`}
                    />
                    <FieldFeedback id="pb-mobile-error" state={mobileFieldState} />
                  </div>

                  <div>
                    <label htmlFor="pb-age" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      Age (Years)
                    </label>
                    <input
                      id="pb-age"
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="e.g. 42"
                      value={age}
                      aria-invalid={ageFieldState.ariaInvalid}
                      aria-describedby={buildDescribedBy({
                        errorId: 'pb-age-error',
                        showError: ageFieldState.showError
                      })}
                      onChange={(e) => setAge(e.target.value)}
                      onBlur={() => interaction.markTouched('age', ageValidation, 'Age')}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                        ageFieldState,
                        'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
                      )}`}
                    />
                    <FieldFeedback id="pb-age-error" state={ageFieldState} />
                  </div>

                  <div>
                    <label htmlFor="pb-gender" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      Gender
                    </label>
                    <select
                      id="pb-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="pb-reason" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      Reason for Consultation / Symptoms
                    </label>
                    <textarea
                      id="pb-reason"
                      rows="2"
                      placeholder="e.g. Fever since 2 days, headache, sore throat"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  {selectedSlot ? (
                    <span>Selected Slot: <strong className="text-slate-800">{formatDate(selectedDate)} at {selectedSlot}</strong></span>
                  ) : (
                    <span>Please choose a time slot to continue.</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Appointment Request'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

