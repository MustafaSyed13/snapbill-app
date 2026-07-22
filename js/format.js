// Formatting helpers: currency, dates, numbers.

export const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar' }, EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' }, CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' }, INR: { symbol: '₹', name: 'Indian Rupee' },
  AED: { symbol: 'AED ', name: 'UAE Dirham' }, PKR: { symbol: 'Rs ', name: 'Pakistani Rupee' },
  NGN: { symbol: '₦', name: 'Nigerian Naira' }, ZAR: { symbol: 'R', name: 'South African Rand' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' }, JPY: { symbol: '¥', name: 'Japanese Yen' },
};

let _currency = 'USD';
export function setDisplayCurrency(code) { if (CURRENCIES[code]) _currency = code; }
export function currencySymbol(code) { return (CURRENCIES[code || _currency] || CURRENCIES.USD).symbol; }

export function money(amount, code) {
  const c = code || _currency;
  const sym = currencySymbol(c);
  const n = Number(amount || 0);
  const decimals = c === 'JPY' ? 0 : 2;
  const str = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (n < 0 ? '-' : '') + sym + str;
}

export function num(n, decimals = 2) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtDateInput(ts) {
  const d = ts ? new Date(ts) : new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseDateInput(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}
export function relativeDays(ts) {
  if (!ts) return '';
  const days = Math.round((ts - startOfDay(Date.now())) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}
export function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function addDays(ts, n) { return ts + n * 86400000; }
export function monthKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
export function monthLabel(ts) { return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
