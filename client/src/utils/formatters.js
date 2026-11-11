// Currency formatting: converts integer paise to INR currency string
export const formatCurrency = (paise) => {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0.00';
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(rupees);
};

// Date formatting
export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
};

// Calculate age from date of birth
export const calculateAge = (dobString) => {
  if (!dobString) return null;
  const birth = new Date(dobString);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    years--;
  }
  return years >= 0 ? years : null;
};

// Status badge styling helper
export const getStatusBadgeStyle = (status) => {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'checked-in':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'in-consultation':
      return 'bg-teal-50 text-teal-800 border-teal-300 font-semibold';
    case 'completed':
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'partially_paid':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'pending':
    case 'requested':
    case 'scheduled':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    case 'cancelled':
    case 'no-show':
    case 'inactive':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

