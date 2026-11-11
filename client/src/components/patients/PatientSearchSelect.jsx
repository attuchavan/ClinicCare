import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { Search, X, UserCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import { calculateAge } from '../../utils/formatters.js';

/**
 * Searchable patient combobox supporting instant filtering by name, mobile number, or patient ID.
 */
export const PatientSearchSelect = ({
  patients = [],
  value = '',
  onChange,
  label = 'Select Patient',
  required = false,
  invalid = false,
  error = '',
  placeholder = 'Type name, mobile number, or ID (e.g. Atharv or 9822)...'
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  const inputId = useId();
  const listboxId = useId();
  const errorId = useId();

  const selectedPatient = useMemo(
    () => patients.find(p => p.id === value) || null,
    [patients, value]
  );

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;

    return patients
      .filter(p => {
        const name = (p.fullName || '').toLowerCase();
        const phone = (p.mobileNumber || '').toLowerCase();
        const pid = (p.patientId || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || pid.includes(q);
      })
      .sort((a, b) => {
        const aStarts = (a.fullName || '').toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = (b.fullName || '').toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      });
  }, [patients, query]);

  // Keep highlighted option bounded and scrolled into view
  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (isOpen && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  // Close dropdown on outside pointer click
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, []);

  const handleSelect = (patient) => {
    onChange(patient.id, patient);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('', null);
    setQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent?.isComposing) return;

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (filteredPatients.length > 0 ? (prev + 1) % filteredPatients.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev =>
        filteredPatients.length > 0 ? (prev - 1 + filteredPatients.length) % filteredPatients.length : 0
      );
    } else if (e.key === 'Enter') {
      if (filteredPatients[activeIndex]) {
        e.preventDefault();
        handleSelect(filteredPatients[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const activeOptionId =
    isOpen && filteredPatients[activeIndex] ? `${listboxId}-opt-${filteredPatients[activeIndex].id}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 mb-1.5">
          {label} {required && <span className="text-rose-600" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Selected Patient Summary Bar vs Search Input */}
      {selectedPatient && !isOpen ? (
        <div className="flex items-center justify-between gap-3 w-full px-3.5 py-2.5 bg-teal-50/70 border border-teal-300 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
          >
            <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 truncate">
                  {selectedPatient.fullName}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-teal-800 border border-teal-200">
                  {selectedPatient.patientId}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium truncate">
                {selectedPatient.mobileNumber}
                {selectedPatient.dateOfBirth ? ` • ${calculateAge(selectedPatient.dateOfBirth)} Yrs` : ''}
                {selectedPatient.gender ? ` • ${selectedPatient.gender}` : ''}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear selected patient and search another"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Change</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={isOpen && filteredPatients.length > 0 ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-required={required || undefined}
            aria-invalid={invalid ? 'true' : 'false'}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${
              invalid
                ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-rose-400'
                : 'bg-slate-50 border-slate-300 focus:border-teal-500 focus:ring-teal-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            tabIndex={-1}
            aria-label={isOpen ? 'Close patient list' : 'Open patient list'}
            className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {error && (
            <p id={errorId} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">Error: </span>
                {error}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-30 relative">
          <div
            role="status"
            aria-live="polite"
            className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500"
          >
            <span>
              {query.trim()
                ? `${filteredPatients.length} matching patient${filteredPatients.length === 1 ? '' : 's'}`
                : `All Patients (${patients.length})`}
            </span>
            <span>Use ↑ ↓ keys &amp; Enter to select</span>
          </div>

          {filteredPatients.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No patient matches <strong className="text-slate-800">&ldquo;{query}&rdquo;</strong>. Try searching by name, mobile number, or patient ID.
            </div>
          ) : (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Matching patients"
              className="max-h-64 overflow-y-auto divide-y divide-slate-100"
            >
              {filteredPatients.map((p, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = p.id === value;
                const age = calculateAge(p.dateOfBirth);

                return (
                  <li
                    key={p.id}
                    id={`${listboxId}-opt-${p.id}`}
                    ref={(el) => { optionRefs.current[idx] = el; }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(p)}
                    className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                      isActive
                        ? 'bg-teal-50 text-slate-900'
                        : isSelected
                          ? 'bg-slate-50'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{p.fullName}</span>
                        <span className="text-[11px] font-bold text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded">
                          {p.patientId}
                        </span>
                        {p.allergies && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {p.allergies}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {p.mobileNumber}
                        {age ? ` • ${age} Yrs` : ''}
                        {p.gender ? ` • ${p.gender}` : ''}
                      </p>
                    </div>

                    {isSelected && (
                      <span className="text-[11px] font-extrabold text-teal-700 shrink-0">Selected</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
