import React, { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

let announcerEl = null;
let announceTimer = null;

/**
 * Single page-wide polite live region so screen reader announcements are serialized and
 * debounced slightly after blur without colliding with the newly focused element.
 */
const getAnnouncer = () => {
  if (typeof document === 'undefined') return null;
  if (!announcerEl || !document.body.contains(announcerEl)) {
    announcerEl = document.createElement('div');
    announcerEl.setAttribute('aria-live', 'polite');
    announcerEl.className = 'visually-hidden';
    document.body.append(announcerEl);
  }
  return announcerEl;
};

export const announceFieldError = (fieldLabel, errorMessage) => {
  const el = getAnnouncer();
  if (!el) return;
  clearTimeout(announceTimer);
  el.textContent = '';
  if (!errorMessage) return;
  announceTimer = setTimeout(() => {
    el.textContent = `${fieldLabel}: Error, ${errorMessage}`;
  }, 500);
};

export const clearFieldErrorAnnouncement = () => {
  clearTimeout(announceTimer);
  if (announcerEl) announcerEl.textContent = '';
};

/**
 * Focus the first invalid control inside a container after a failed form submission.
 */
export const focusFirstInvalidField = (containerEl) => {
  if (!containerEl) return;
  requestAnimationFrame(() => {
    const firstInvalid = containerEl.querySelector('[aria-invalid="true"], :invalid');
    if (firstInvalid && typeof firstInvalid.focus === 'function') {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.focus();
    }
  });
};

/**
 * Compute live visual & ARIA state for any validator result.
 */
export const getFieldValidationState = (result = { valid: true }, { touched = false, submitted = false } = {}) => {
  const showError = Boolean(result.immediateError || ((touched || submitted) && result.blurError));
  const message = result.immediateError || result.blurError || '';
  const showValid = !showError && Boolean(result.valid && result.validText);
  const showHint = !showError && !showValid && Boolean(result.hint);

  return {
    showError,
    showValid,
    showHint,
    message,
    validText: result.validText || '',
    hint: result.hint || '',
    ariaInvalid: showError ? 'true' : 'false'
  };
};

/**
 * Build aria-describedby value dynamically so hidden error elements are never referenced.
 */
export const buildDescribedBy = ({ hintId, errorId, showError } = {}) => {
  const ids = [];
  if (hintId) ids.push(hintId);
  if (showError && errorId) ids.push(errorId);
  return ids.length ? ids.join(' ') : undefined;
};

/**
 * Border & ring utility classes synchronized with live validation state.
 */
export const getValidationInputClasses = (
  state,
  baseFocusClasses = 'border-slate-200 focus:border-teal-500 focus:ring-teal-500'
) => {
  if (state?.showError) {
    return 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-400';
  }
  if (state?.showValid) {
    return 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500';
  }
  return baseFocusClasses;
};

/**
 * Hook tracking per-field blur interaction and submission state cleanly without duplicating logic.
 */
export const useFormInteraction = () => {
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const markTouched = useCallback((fieldKey, result, fieldLabel) => {
    setTouched(prev => (prev[fieldKey] ? prev : { ...prev, [fieldKey]: true }));
    if (result && (result.immediateError || result.blurError) && fieldLabel) {
      announceFieldError(fieldLabel, result.immediateError || result.blurError);
    }
  }, []);

  const getFieldState = useCallback(
    (fieldKey, result) =>
      getFieldValidationState(result, {
        touched: Boolean(touched[fieldKey]),
        submitted
      }),
    [touched, submitted]
  );

  const resetInteraction = useCallback(() => {
    setTouched({});
    setSubmitted(false);
    clearFieldErrorAnnouncement();
  }, []);

  return {
    touched,
    submitted,
    setSubmitted,
    markTouched,
    getFieldState,
    resetInteraction
  };
};

/**
 * Inline live validation feedback row (error text with non-color icon, valid badge, or typing counter).
 */
export const FieldFeedback = ({ id, state, className = '', compact = false }) => {
  if (!state) return null;

  if (state.showError) {
    return (
      <p
        id={id}
        className={`mt-1 flex items-center gap-1 font-medium text-rose-600 ${
          compact ? 'text-[10px] leading-tight justify-center' : 'text-[11px]'
        } ${className}`}
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="sr-only">Error: </span>
          {state.message}
        </span>
      </p>
    );
  }

  if (state.showValid) {
    return (
      <p
        className={`mt-1 flex items-center gap-1 font-semibold text-emerald-700 ${
          compact ? 'text-[10px] leading-tight justify-center' : 'text-[11px]'
        } ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{state.validText}</span>
      </p>
    );
  }

  if (state.showHint) {
    return (
      <p
        className={`mt-1 font-semibold text-slate-500 ${
          compact ? 'text-[10px] leading-tight text-center' : 'text-[11px]'
        } ${className}`}
      >
        {state.hint}
      </p>
    );
  }

  return null;
};

