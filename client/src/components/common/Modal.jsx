import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

const MAX_WIDTH_MAP = {
  'max-w-sm': '24rem',
  'max-w-md': '28rem',
  'max-w-lg': '32rem',
  'max-w-xl': '36rem',
  'max-w-2xl': '42rem',
  'max-w-3xl': '48rem',
  'max-w-4xl': '58rem',
  'max-w-5xl': '66rem',
  'max-w-6xl': '74rem'
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
  showCloseButton = true
}) => {
  const dialogRef = useRef(null);
  const pressedOutsideRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle native cancel event (Esc key & back gesture)
  const handleCancel = (e) => {
    e.preventDefault();
    onClose();
  };

  // Safe light-dismiss check outside bounding rect (avoids padding click misfires)
  const isOutsideDialog = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  const handlePointerDown = (e) => {
    if (dialogRef.current) {
      pressedOutsideRef.current = isOutsideDialog(e, dialogRef.current);
    }
  };

  const handlePointerUp = (e) => {
    if (dialogRef.current && pressedOutsideRef.current && isOutsideDialog(e, dialogRef.current)) {
      onClose();
    }
    pressedOutsideRef.current = false;
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-labelledby={titleId}
      className="p-0 rounded-2xl shadow-2xl bg-white w-[calc(100%-2rem)] border border-slate-200/80 m-auto focus:outline-none overflow-hidden"
      style={{ maxWidth: MAX_WIDTH_MAP[maxWidth] || '42rem' }}
    >
      <div className="w-full flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold text-slate-900 tracking-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                {subtitle}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/70 transition-colors shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </dialog>
  );
};
