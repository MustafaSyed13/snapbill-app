// Invoice math, status derivation, and business analytics.
import { startOfDay, monthKey, monthLabel } from './format.js';

export const STATUSES = ['draft', 'sent', 'viewed', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled'];
export const STATUS_META = {
  draft: { label: 'Draft', color: 'slate' },
  sent: { label: 'Sent', color: 'blue' },
  viewed: { label: 'Viewed', color: 'indigo' },
  pending: { label: 'Pending', color: 'amber' },
  partially_paid: { label: 'Partially Paid', color: 'violet' },
  paid: { label: 'Paid', color: 'emerald' },
  overdue: { label: 'Overdue', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'slate' },
};

export function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

// Compute all monetary totals for an invoice.
export function computeTotals(inv, payments = []) {
  const lines = inv.lineItems || [];
  let subtotal = 0, taxableBase = 0;
  for (const li of lines) {
    const qty = Number(li.qty || 0);
    const price = Number(li.price || 0);
    let lineTotal = qty * price;
    if (li.discountPct) lineTotal -= lineTotal * (Number(li.discountPct) / 100);
    lineTotal = round2(lineTotal);
    li._lineTotal = lineTotal;
    subtotal += lineTotal;
    if (li.taxable) taxableBase += lineTotal;
  }
  subtotal = round2(subtotal);

  // Invoice-level discount
  let discount = 0;
  if (inv.discountType === 'percent') discount = round2(subtotal * (Number(inv.discountValue || 0) / 100));
  else if (inv.discountType === 'amount') discount = round2(Number(inv.discountValue || 0));
  discount = Math.min(discount, subtotal);

  // Apply discount proportionally to taxable base
  const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 1;
  const taxedBase = round2(taxableBase * discountFactor);
  const taxRate = Number(inv.taxRate || 0);
  const tax = round2(taxedBase * (taxRate / 100));

  const total = round2(subtotal - discount + tax);
  const paid = round2((payments || []).reduce((s, p) => s + Number(p.amount || 0), 0));
  const balance = round2(total - paid);
  const deposit = round2(Number(inv.depositRequested || 0));

  return { subtotal, discount, taxableBase: taxedBase, taxRate, tax, total, paid, balance, deposit };
}

// Derive the effective status considering payments and due date.
// User-set terminal states (draft/cancelled) and workflow states are respected;
// payment + overdue conditions upgrade the status automatically.
export function effectiveStatus(inv, totals) {
  if (inv.status === 'cancelled') return 'cancelled';
  if (inv.status === 'draft') return 'draft';
  const t = totals;
  if (t.total > 0 && t.paid >= t.total) return 'paid';
  if (t.paid > 0 && t.paid < t.total) {
    if (inv.dueDate && startOfDay(inv.dueDate) < startOfDay(Date.now())) return 'overdue';
    return 'partially_paid';
  }
  if (inv.dueDate && startOfDay(inv.dueDate) < startOfDay(Date.now())) return 'overdue';
  return inv.status || 'pending';
}

export function isOpen(status) {
  return !['paid', 'cancelled', 'draft'].includes(status);
}

// ---------- Analytics over a set of invoices/payments ----------
export function analytics(invoices, payments, range) {
  const paysByInv = groupBy(payments, p => p.invoiceId);
  const enriched = invoices.map(inv => {
    const pays = paysByInv[inv.id] || [];
    const totals = computeTotals(inv, pays);
    const status = effectiveStatus(inv, totals);
    return { inv, totals, status, pays };
  });

  const inRange = enriched.filter(e => {
    if (!range) return true;
    const d = e.inv.issueDate || e.inv.createdAt;
    return d >= range.from && d <= range.to;
  });

  const billable = inRange.filter(e => e.status !== 'cancelled' && e.status !== 'draft');

  let totalSales = 0, collected = 0, outstanding = 0, overdue = 0;
  let paidCount = 0, pendingCount = 0, overdueCount = 0, draftCount = 0;
  for (const e of billable) {
    totalSales += e.totals.total;
    collected += e.totals.paid;
    if (e.status === 'paid') paidCount++;
    else {
      outstanding += e.totals.balance;
      if (e.status === 'overdue') { overdue += e.totals.balance; overdueCount++; }
      else pendingCount++;
    }
  }
  for (const e of inRange) if (e.status === 'draft') draftCount++;

  const avgInvoice = billable.length ? totalSales / billable.length : 0;

  // Monthly revenue series (by issue date, billable)
  const monthMap = {};
  for (const e of billable) {
    const k = monthKey(e.inv.issueDate || e.inv.createdAt);
    monthMap[k] = (monthMap[k] || 0) + e.totals.total;
  }
  const months = lastNMonths(6);
  const monthlySeries = months.map(m => ({ key: m.key, label: m.label, value: round2(monthMap[m.key] || 0) }));

  // Top customers (by billed within range)
  const custMap = {};
  for (const e of billable) {
    const cid = e.inv.customerId || (e.inv.customerSnapshot && e.inv.customerSnapshot.id) || 'unknown';
    const name = (e.inv.customerSnapshot && e.inv.customerSnapshot.name) || 'Unknown';
    if (!custMap[cid]) custMap[cid] = { id: cid, name, billed: 0, paid: 0, count: 0, balance: 0 };
    custMap[cid].billed += e.totals.total;
    custMap[cid].paid += e.totals.paid;
    custMap[cid].balance += e.totals.balance;
    custMap[cid].count++;
  }
  const topCustomers = Object.values(custMap).sort((a, b) => b.billed - a.billed);

  // Best-selling items & packages (by revenue) within range
  const itemMap = {}, pkgMap = {};
  for (const e of billable) {
    for (const li of (e.inv.lineItems || [])) {
      const rev = Number(li._lineTotal != null ? li._lineTotal : (li.qty * li.price)) || 0;
      const qty = Number(li.qty || 0);
      if (li.packageRef) {
        const key = li.packageName || li.name;
        if (!pkgMap[key]) pkgMap[key] = { name: key, revenue: 0, count: 0 };
        pkgMap[key].revenue += rev; pkgMap[key].count += qty;
      }
      const key = (li.name || 'Item').trim();
      if (!itemMap[key]) itemMap[key] = { name: key, revenue: 0, qty: 0 };
      itemMap[key].revenue += rev; itemMap[key].qty += qty;
    }
  }
  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
  const topPackages = Object.values(pkgMap).sort((a, b) => b.revenue - a.revenue);

  return {
    enriched, inRange, billable,
    totalSales: round2(totalSales), collected: round2(collected), outstanding: round2(outstanding),
    overdue: round2(overdue), paidCount, pendingCount, overdueCount, draftCount,
    avgInvoice: round2(avgInvoice), monthlySeries, topCustomers, topItems, topPackages,
    count: billable.length,
  };
}

export function groupBy(arr, fn) {
  const out = {};
  for (const x of arr) { const k = fn(x); (out[k] = out[k] || []).push(x); }
  return out;
}

export function lastNMonths(n) {
  const out = [];
  const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: monthKey(dd.getTime()), label: monthLabel(dd.getTime()) });
  }
  return out;
}

// Named date ranges
export function rangeFor(kind, custom) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const startOf = (d) => new Date(d).setHours(0, 0, 0, 0);
  switch (kind) {
    case 'week': { const s = new Date(); s.setDate(s.getDate() - 6); return { from: startOf(s), to: end, label: 'Last 7 days' }; }
    case 'month': { const s = new Date(now.getFullYear(), now.getMonth(), 1); return { from: s.getTime(), to: end, label: 'This month' }; }
    case 'quarter': { const q = Math.floor(now.getMonth() / 3); const s = new Date(now.getFullYear(), q * 3, 1); return { from: s.getTime(), to: end, label: 'This quarter' }; }
    case 'year': { const s = new Date(now.getFullYear(), 0, 1); return { from: s.getTime(), to: end, label: 'This year' }; }
    case 'all': return { from: 0, to: end, label: 'All time' };
    case 'custom': return { from: custom.from, to: custom.to, label: 'Custom' };
    default: { const s = new Date(now.getFullYear(), now.getMonth(), 1); return { from: s.getTime(), to: end, label: 'This month' }; }
  }
}
