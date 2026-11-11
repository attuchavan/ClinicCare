import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck,
  UserPlus,
  ShieldCheck,
  Mail,
  Phone,
  Power,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api.js';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { formatDate } from '../../utils/formatters.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  validateFullName,
  validateEmail,
  validateMobile,
  validatePassword,
  normalizeMobile
} from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

export const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add staff modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('Staff@123');
  const [role, setRole] = useState('receptionist');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const staffFormRef = useRef(null);
  const staffInteraction = useFormInteraction();

  const nameValidation = validateFullName(name);
  const emailValidation = validateEmail(email);
  const phoneValidation = validateMobile(phone, { required: false, label: 'Mobile contact' });
  const passwordValidation = validatePassword(tempPassword, { required: true, min: 6 });

  const nameFieldState = staffInteraction.getFieldState('name', nameValidation);
  const emailFieldState = staffInteraction.getFieldState('email', emailValidation);
  const phoneFieldState = staffInteraction.getFieldState('phone', phoneValidation);
  const passwordFieldState = staffInteraction.getFieldState('tempPassword', passwordValidation);

  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await api.auth.getStaff();
      setStaff(data || []);
    } catch (err) {
      showToast('Failed to load clinic staff', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const resetStaffModal = () => {
    setName('');
    setEmail('');
    setPhone('');
    setTempPassword('Staff@123');
    setRole('receptionist');
    staffInteraction.resetInteraction();
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    staffInteraction.setSubmitted(true);

    if (!nameValidation.valid || !emailValidation.valid || !phoneValidation.valid || !passwordValidation.valid) {
      const firstErr =
        nameValidation.error ||
        emailValidation.error ||
        phoneValidation.error ||
        passwordValidation.error;
      showToast(firstErr || 'Please fix the highlighted staff fields', 'warning');
      focusFirstInvalidField(staffFormRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanPhone = phoneValidation.normalized || normalizeMobile(phone);
      await api.auth.createStaff({
        name: name.trim(),
        email: email.trim(),
        phone: cleanPhone,
        role,
        password: tempPassword || 'Staff@123'
      });
      showToast(`Staff account for ${name.trim()} created successfully!`, 'success');
      setIsAddModalOpen(false);
      resetStaffModal();
      loadStaff();
    } catch (err) {
      showToast(err.message || 'Failed to create staff member', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (staffMember) => {
    const nextStatus = staffMember.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`Are you sure you want to mark ${staffMember.name} as ${nextStatus}?`)) {
      return;
    }

    try {
      await api.auth.toggleStaffStatus(staffMember.id, nextStatus);
      showToast(`Account status updated to ${nextStatus}`, 'success');
      loadStaff();
    } catch (err) {
      showToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-brand-600" />
            Clinic Staff & Receptionist Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Control clinic access, provision authorized receptionist accounts, and deactivate logins.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Authorize New Staff Account
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Loading authorized staff accounts..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-400">{s.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      {s.phone || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${s.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                        {s.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {s.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${s.status === 'active'
                            ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                        >
                          <Power className="w-3 h-3" />
                          {s.status === 'active' ? 'Deactivate' : 'Activate'}
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

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetStaffModal();
        }}
        title="Authorize New Clinic Staff Member"
        maxWidth="max-w-md"
      >
        <form ref={staffFormRef} noValidate onSubmit={handleAddStaff} className="space-y-4">
          <div>
            <label htmlFor="sm-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Full Name *
            </label>
            <input
              id="sm-name"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Pooja Verma"
              value={name}
              aria-invalid={nameFieldState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'sm-name-error',
                showError: nameFieldState.showError
              })}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => staffInteraction.markTouched('name', nameValidation, 'Full name')}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                nameFieldState,
                'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
              )}`}
            />
            <FieldFeedback id="sm-name-error" state={nameFieldState} />
          </div>

          <div>
            <label htmlFor="sm-email" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Email Address *
            </label>
            <input
              id="sm-email"
              type="email"
              required
              autoComplete="email"
              placeholder="e.g. reception2@cliniccare.com"
              value={email}
              aria-invalid={emailFieldState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'sm-email-error',
                showError: emailFieldState.showError
              })}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => staffInteraction.markTouched('email', emailValidation, 'Email address')}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                emailFieldState,
                'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
              )}`}
            />
            <FieldFeedback id="sm-email-error" state={emailFieldState} />
          </div>

          <div>
            <label htmlFor="sm-phone" className="block text-xs font-bold text-slate-700 uppercase mb-0.5">
              Mobile Contact
            </label>
            <p id="sm-phone-hint" className="text-[11px] text-slate-500 mb-1">
              Optional 10-digit Indian mobile starting with 6–9
            </p>
            <input
              id="sm-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={14}
              placeholder="e.g. 9876512345"
              value={phone}
              aria-invalid={phoneFieldState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                hintId: 'sm-phone-hint',
                errorId: 'sm-phone-error',
                showError: phoneFieldState.showError
              })}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => staffInteraction.markTouched('phone', phoneValidation, 'Mobile contact')}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                phoneFieldState,
                'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
              )}`}
            />
            <FieldFeedback id="sm-phone-error" state={phoneFieldState} />
          </div>

          <div>
            <label htmlFor="sm-role" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Access Role *
            </label>
            <select
              id="sm-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
            >
              <option value="receptionist">Receptionist (Bookings, Billing, Patient Registration)</option>
              <option value="doctor">Associate Doctor (Clinical, Prescriptions, Records)</option>
            </select>
          </div>

          <div>
            <label htmlFor="sm-password" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Initial Temporary Password
            </label>
            <input
              id="sm-password"
              type="text"
              placeholder="e.g. Staff@123"
              value={tempPassword}
              aria-invalid={passwordFieldState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                hintId: 'sm-password-hint',
                errorId: 'sm-password-error',
                showError: passwordFieldState.showError
              })}
              onChange={(e) => setTempPassword(e.target.value)}
              onBlur={() => staffInteraction.markTouched('tempPassword', passwordValidation, 'Initial temporary password')}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                passwordFieldState,
                'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
              )}`}
            />
            <FieldFeedback id="sm-password-error" state={passwordFieldState} />
            <p id="sm-password-hint" className="text-[11px] text-slate-500 mt-1">
              Staff member will use this to sign in and can change it via forgot password link.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                resetStaffModal();
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Authorizing...' : 'Authorize Staff Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

