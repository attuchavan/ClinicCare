import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building2,
  Clock,
  DollarSign,
  Save,
  CheckCircle2,
  Calendar,
  Coffee,
  Copy
} from 'lucide-react';
import { api } from '../../services/api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  validateRequiredText,
  validateClinicPhone,
  validateEmail,
  validateAmount
} from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const DEFAULT_SCHEDULE = {
  monday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00', closed: false },
  tuesday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00', closed: false },
  wednesday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00', closed: false },
  thursday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00', closed: false },
  friday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00', closed: false },
  saturday: { open: '09:00', close: '14:00', lunchStart: '', lunchEnd: '', closed: false },
  sunday: { open: '09:00', close: '13:00', lunchStart: '', lunchEnd: '', closed: true }
};

export const ClinicSettings = () => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const formRef = useRef(null);
  const interaction = useFormInteraction();

  const { updateClinicState } = useAuth();
  const { showToast } = useToast();

  const clinicNameValidation = validateRequiredText(settings?.name, 'Clinic name', { min: 2, max: 120 });
  const doctorNameValidation = validateRequiredText(settings?.doctorName, 'Doctor full name', { min: 2, max: 120 });
  const regNoValidation = validateRequiredText(settings?.doctorRegNo, 'Medical council registration number', { min: 2, max: 60 });
  const phoneValidation = validateClinicPhone(settings?.phone);
  const emailValidation = validateEmail(settings?.email);
  const feeValidation = validateAmount(settings?.consultationFeeRupees, 'Consultation fee', { required: true, min: 0, max: 1000000 });
  const followUpDaysValidation = validateAmount(settings?.followUpValidityDays, 'Follow-up validity days', { required: false, min: 1, max: 90, integer: true });

  const clinicNameState = interaction.getFieldState('name', clinicNameValidation);
  const doctorNameState = interaction.getFieldState('doctorName', doctorNameValidation);
  const regNoState = interaction.getFieldState('doctorRegNo', regNoValidation);
  const phoneState = interaction.getFieldState('phone', phoneValidation);
  const emailState = interaction.getFieldState('email', emailValidation);
  const feeState = interaction.getFieldState('consultationFeeRupees', feeValidation);
  const followUpDaysState = interaction.getFieldState('followUpValidityDays', followUpDaysValidation);

  useEffect(() => {
    api.clinic.get()
      .then(data => {
        // Normalize workingHours with defaults if missing
        const workingHours = { ...DEFAULT_SCHEDULE, ...(data.workingHours || {}) };
        DAYS_OF_WEEK.forEach(({ key }) => {
          if (!workingHours[key]) {
            workingHours[key] = { ...DEFAULT_SCHEDULE[key] };
          }
        });

        setSettings({
          ...data,
          workingHours,
          consultationFeeRupees: data.consultationFee ? data.consultationFee / 100 : 500
        });
      })
      .catch(err => {
        showToast('Failed to load clinic settings', 'error');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleDayChange = (dayKey, field, value) => {
    setSettings(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [dayKey]: {
          ...prev.workingHours[dayKey],
          [field]: value
        }
      }
    }));
  };

  const copyMondayToWeekdays = () => {
    const mondayConfig = settings.workingHours.monday;
    if (!mondayConfig) return;

    setSettings(prev => {
      const updatedHours = { ...prev.workingHours };
      ['tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
        updatedHours[day] = { ...mondayConfig };
      });
      return { ...prev, workingHours: updatedHours };
    });
    showToast('Copied Monday timing to Tue–Fri', 'success');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    interaction.setSubmitted(true);

    const checks = [
      clinicNameValidation,
      doctorNameValidation,
      regNoValidation,
      phoneValidation,
      emailValidation,
      feeValidation,
      followUpDaysValidation
    ];
    const firstFailed = checks.find(c => !c.valid);
    if (firstFailed) {
      showToast(firstFailed.error || 'Please fix the highlighted clinic configuration fields', 'warning');
      focusFirstInvalidField(formRef.current);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...settings,
        name: settings.name.trim(),
        doctorName: settings.doctorName.trim(),
        doctorRegNo: settings.doctorRegNo.trim(),
        phone: settings.phone.trim(),
        email: settings.email.trim(),
        consultationFee: Math.round(Number(settings.consultationFeeRupees) * 100) // convert to paise
      };
      delete payload.consultationFeeRupees;

      const updated = await api.clinic.update(payload);
      setSettings({
        ...updated,
        workingHours: updated.workingHours || settings.workingHours,
        consultationFeeRupees: updated.consultationFee ? updated.consultationFee / 100 : 500
      });
      updateClinicState(updated);
      interaction.resetInteraction();
      showToast('Clinic configuration and working hours saved!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) {
    return <LoadingSpinner message="Loading clinic configuration..." size="lg" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-brand-600" />
          Clinic Configuration & Working Schedule
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Configure clinical details, medical council registration, consultation fees, and working hours.
        </p>
      </div>

      <form ref={formRef} noValidate onSubmit={handleSave} className="space-y-6">
        {/* Clinic & Doctor Profile */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> 1. Clinic & Practitioner Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cs-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Clinic Name *
              </label>
              <input
                id="cs-name"
                type="text"
                required
                value={settings.name || ''}
                aria-invalid={clinicNameState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cs-name-error', showError: clinicNameState.showError })}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                onBlur={() => interaction.markTouched('name', clinicNameValidation, 'Clinic name')}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(clinicNameState)}`}
              />
              <FieldFeedback id="cs-name-error" state={clinicNameState} />
            </div>

            <div>
              <label htmlFor="cs-tagline" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Tagline / Subtitle
              </label>
              <input
                id="cs-tagline"
                type="text"
                value={settings.tagline || ''}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label htmlFor="cs-doctor-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Doctor Full Name & Qualifications *
              </label>
              <input
                id="cs-doctor-name"
                type="text"
                required
                value={settings.doctorName || ''}
                aria-invalid={doctorNameState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cs-doctor-name-error', showError: doctorNameState.showError })}
                onChange={(e) => setSettings({ ...settings, doctorName: e.target.value })}
                onBlur={() => interaction.markTouched('doctorName', doctorNameValidation, 'Doctor full name')}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-navy-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(doctorNameState)}`}
              />
              <FieldFeedback id="cs-doctor-name-error" state={doctorNameState} />
            </div>

            <div>
              <label htmlFor="cs-reg-no" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                MCI / State Medical Council Registration No. *
              </label>
              <input
                id="cs-reg-no"
                type="text"
                required
                value={settings.doctorRegNo || ''}
                aria-invalid={regNoState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cs-reg-no-error', showError: regNoState.showError })}
                onChange={(e) => setSettings({ ...settings, doctorRegNo: e.target.value })}
                onBlur={() => interaction.markTouched('doctorRegNo', regNoValidation, 'Registration number')}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm font-mono text-teal-700 font-bold focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(regNoState)}`}
              />
              <FieldFeedback id="cs-reg-no-error" state={regNoState} />
            </div>

            <div>
              <label htmlFor="cs-phone" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Clinic Phone Number *
              </label>
              <input
                id="cs-phone"
                type="tel"
                inputMode="tel"
                required
                value={settings.phone || ''}
                aria-invalid={phoneState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cs-phone-error', showError: phoneState.showError })}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                onBlur={() => interaction.markTouched('phone', phoneValidation, 'Clinic phone number')}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(phoneState)}`}
              />
              <FieldFeedback id="cs-phone-error" state={phoneState} />
            </div>

            <div>
              <label htmlFor="cs-email" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Clinic Official Email *
              </label>
              <input
                id="cs-email"
                type="email"
                required
                value={settings.email || ''}
                aria-invalid={emailState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cs-email-error', showError: emailState.showError })}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                onBlur={() => interaction.markTouched('email', emailValidation, 'Clinic official email')}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(emailState)}`}
              />
              <FieldFeedback id="cs-email-error" state={emailState} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cs-address" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Physical Clinic Address (Appears on Prescriptions & Receipts)
              </label>
              <input
                id="cs-address"
                type="text"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Financial & Fee Rules */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> 2. Consultation Fees & Follow-up Validity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cs-fee" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Standard Consultation Fee (₹ INR)
              </label>
              <input
                id="cs-fee"
                type="text"
                inputMode="decimal"
                required
                value={settings.consultationFeeRupees ?? 500}
                aria-invalid={feeState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cs-fee-error', showError: feeState.showError })}
                onChange={(e) => setSettings({ ...settings, consultationFeeRupees: e.target.value })}
                onBlur={() => interaction.markTouched('consultationFeeRupees', feeValidation, 'Standard consultation fee')}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm font-bold text-emerald-700 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(feeState)}`}
              />
              <FieldFeedback id="cs-fee-error" state={feeState} />
              <span className="text-[10px] text-slate-400">Stored internally in paise for integer accuracy</span>
            </div>

            <div>
              <label htmlFor="cs-followup-days" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Free Follow-up Validity Window (Days)
              </label>
              <input
                id="cs-followup-days"
                type="text"
                inputMode="numeric"
                value={settings.followUpValidityDays ?? 7}
                aria-invalid={followUpDaysState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cs-followup-days-error', showError: followUpDaysState.showError })}
                onChange={(e) => setSettings({ ...settings, followUpValidityDays: e.target.value })}
                onBlur={() => interaction.markTouched('followUpValidityDays', followUpDaysValidation, 'Follow-up validity days')}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(followUpDaysState)}`}
              />
              <FieldFeedback id="cs-followup-days-error" state={followUpDaysState} />
              <span className="text-[10px] text-slate-400">Days after consultation when review visit has no extra fee</span>
            </div>
          </div>
        </div>

        {/* Operating Hours & Appointment Slots */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
                <Clock className="w-4 h-4" /> 3. Working Schedule & Slot Duration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Appointments are generated based on these daily timings and break windows.
              </p>
            </div>

            <button
              type="button"
              onClick={copyMondayToWeekdays}
              className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Mon to Tue–Fri
            </button>
          </div>

          {/* Slot Duration */}
          <div className="max-w-xs">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Appointment Slot Duration (Minutes)
            </label>
            <select
              value={settings.slotDurationMinutes || 15}
              onChange={(e) => setSettings({ ...settings, slotDurationMinutes: Number(e.target.value) })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            >
              <option value={10}>10 Minutes per patient</option>
              <option value={15}>15 Minutes (Standard General Practice)</option>
              <option value={20}>20 Minutes per patient</option>
              <option value={30}>30 Minutes per patient</option>
            </select>
          </div>

          {/* Weekly Schedule Table / Cards */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Weekly Consultation Timings
            </label>

            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const dayConfig = settings.workingHours?.[key] || { closed: false, open: '09:00', close: '20:00' };
                const isClosed = Boolean(dayConfig.closed);

                return (
                  <div
                    key={key}
                    className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                      isClosed ? 'bg-slate-50/70 text-slate-400' : 'bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Day & Open/Closed Toggle */}
                    <div className="w-36 flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!isClosed}
                          onChange={(e) => handleDayChange(key, 'closed', !e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-brand-600"></div>
                      </label>
                      <span className={`text-sm font-bold capitalize ${isClosed ? 'text-slate-400' : 'text-navy-900'}`}>
                        {label}
                      </span>
                    </div>

                    {/* Hours Configuration */}
                    {!isClosed ? (
                      <div className="flex-1 flex flex-wrap items-center gap-4 text-xs">
                        {/* Working Window */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Open:</span>
                          <input
                            type="time"
                            required
                            value={dayConfig.open || '09:00'}
                            onChange={(e) => handleDayChange(key, 'open', e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="time"
                            required
                            value={dayConfig.close || '20:00'}
                            onChange={(e) => handleDayChange(key, 'close', e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                          />
                        </div>

                        {/* Lunch Break Window */}
                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                          <Coffee className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-slate-500 font-medium">Break:</span>
                          <input
                            type="time"
                            value={dayConfig.lunchStart || ''}
                            onChange={(e) => handleDayChange(key, 'lunchStart', e.target.value)}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="time"
                            value={dayConfig.lunchEnd || ''}
                            onChange={(e) => handleDayChange(key, 'lunchEnd', e.target.value)}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 text-xs text-slate-400 italic">
                        Closed for consultations
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving Changes...' : 'Save Clinic Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
