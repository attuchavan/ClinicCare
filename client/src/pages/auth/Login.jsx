import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Lock,
  Mail,
  Activity,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { validateEmail, validatePassword } from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState('doctor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const loginFormRef = useRef(null);
  const resetFormRef = useRef(null);
  const loginInteraction = useFormInteraction();
  const resetInteraction = useFormInteraction();

  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password, { required: true, min: 6 });
  const resetEmailValidation = validateEmail(resetEmail);

  const emailState = loginInteraction.getFieldState('email', emailValidation);
  const passwordState = loginInteraction.getFieldState('password', passwordValidation);
  const resetEmailState = resetInteraction.getFieldState('resetEmail', resetEmailValidation);

  const { login, resetPassword, isFirebaseConfigured } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const formatAuthError = (err) => {
    const code = err.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Invalid email or password. Please verify your credentials.';
    }
    if (code === 'auth/user-not-found') {
      return 'No registered staff account found with this email.';
    }
    if (code === 'auth/user-disabled') {
      return 'This account has been deactivated. Please contact the administrator.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Access temporarily restricted due to multiple failed attempts. Try again later.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection error. Please check your internet connection.';
    }
    return err.message || 'Login failed. Please check your credentials.';
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    loginInteraction.setSubmitted(true);
    if (!emailValidation.valid || !passwordValidation.valid) {
      const firstErr = emailValidation.error || passwordValidation.error;
      showToast(firstErr || 'Please check your email and password', 'warning');
      focusFirstInvalidField(loginFormRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password, role: selectedRole });
      showToast(`Welcome back, ${user.name}!`, 'success');
      navigate(user.role === 'doctor' ? '/doctor' : '/receptionist');
    } catch (err) {
      showToast(formatAuthError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (roleType) => {
    if (roleType === 'doctor') {
      setEmail('doctor@cliniccare.com');
      setPassword('Doctor@123');
      setSelectedRole('doctor');
    } else {
      setEmail('reception@cliniccare.com');
      setPassword('Staff@123');
      setSelectedRole('receptionist');
    }
    loginInteraction.resetInteraction();
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    resetInteraction.setSubmitted(true);
    if (!resetEmailValidation.valid) {
      showToast(resetEmailValidation.error || 'Please enter a valid clinic email', 'warning');
      focusFirstInvalidField(resetFormRef.current);
      return;
    }

    setIsResetSubmitting(true);
    try {
      const res = await resetPassword(resetEmail.trim());
      showToast(res?.message || `Password reset instructions dispatched to ${resetEmail}`, 'success');
      setIsResetModalOpen(false);
      setResetEmail('');
      resetInteraction.resetInteraction();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch reset email', 'error');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3.5 bg-teal-600 rounded-2xl shadow-lg shadow-teal-600/25 text-white flex items-center justify-center">
            <Activity className="w-9 h-9" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          ClinicCare
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600 font-medium">
          Simple Digital Clinic • Doctor & Reception Desk
        </p>

        {isFirebaseConfigured && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-teal-800 bg-teal-50 border border-teal-200/80 rounded-full px-3 py-1 w-max mx-auto font-semibold">
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            <span>Firebase Cloud Sync Ready</span>
          </div>
        )}
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-xl border border-slate-200/90">
          {/* Role Selector Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setSelectedRole('doctor'); handleQuickLogin('doctor'); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${selectedRole === 'doctor'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Stethoscope className="w-4 h-4 text-teal-600" />
              Doctor Portal
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole('receptionist'); handleQuickLogin('receptionist'); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${selectedRole === 'receptionist'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Receptionist
            </button>
          </div>

          <form ref={loginFormRef} noValidate onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Staff Email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  spellCheck="false"
                  autoComplete="username"
                  value={email}
                  aria-invalid={emailState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    errorId: 'login-email-error',
                    showError: emailState.showError
                  })}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => loginInteraction.markTouched('email', emailValidation, 'Staff email')}
                  placeholder="e.g. doctor@cliniccare.com"
                  className={`block w-full pl-10 pr-3 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                    emailState,
                    'border-slate-200 focus:border-teal-500 focus:ring-teal-500'
                  )}`}
                />
              </div>
              <FieldFeedback id="login-email-error" state={emailState} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    resetInteraction.resetInteraction();
                    setIsResetModalOpen(true);
                  }}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={passwordState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    errorId: 'login-password-error',
                    showError: passwordState.showError
                  })}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => loginInteraction.markTouched('password', passwordValidation, 'Password')}
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                    passwordState,
                    'border-slate-200 focus:border-teal-500 focus:ring-teal-500'
                  )}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <FieldFeedback id="login-password-error" state={passwordState} />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Authenticating...' : `Sign in as ${selectedRole === 'doctor' ? 'Doctor' : 'Receptionist'}`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Assistant (dev / explicit demo mode only) */}
          {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true') && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 text-center mb-3">
                One-Click Credentials (Testing Mode)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('doctor')}
                  className="p-2 text-xs font-semibold bg-teal-50 text-teal-800 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors text-center"
                >
                  Autofill Doctor
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('receptionist')}
                  className="p-2 text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors text-center"
                >
                  Autofill Receptionist
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Public Booking Link */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Looking to book an appointment as a patient?{' '}
          <a href="/book" className="font-bold text-teal-700 hover:text-teal-800 underline">
            Patient Online Booking
          </a>
        </p>
      </div>

      {/* Password Reset Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => {
          setIsResetModalOpen(false);
          resetInteraction.resetInteraction();
        }}
        title="Reset Account Password"
        maxWidth="max-w-md"
      >
        <form ref={resetFormRef} noValidate onSubmit={handlePasswordReset} className="space-y-4">
          <p className="text-sm text-slate-600">
            Enter your registered clinic staff email. An authorized recovery reset link will be sent to your inbox.
          </p>
          <div>
            <label htmlFor="reset-email" className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Registered Email
            </label>
            <input
              id="reset-email"
              name="resetEmail"
              type="email"
              required
              spellCheck="false"
              autoComplete="email"
              value={resetEmail}
              aria-invalid={resetEmailState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'reset-email-error',
                showError: resetEmailState.showError
              })}
              onChange={(e) => setResetEmail(e.target.value)}
              onBlur={() => resetInteraction.markTouched('resetEmail', resetEmailValidation, 'Registered email')}
              placeholder="e.g. doctor@cliniccare.com"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                resetEmailState,
                'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
              )}`}
            />
            <FieldFeedback id="reset-email-error" state={resetEmailState} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsResetModalOpen(false);
                resetInteraction.resetInteraction();
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResetSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
            >
              {isResetSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
