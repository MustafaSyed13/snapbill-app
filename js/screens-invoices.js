// Invoice screens: list, detail, editor, preview.
import { h, icon, navigate, state, toast, modal, frag, confirmDialog } from './lib.js';
import { pageHeader, fieldRow, textInput, textArea, selectInput, statusPill, loadAccountData, pickerModal, stickyActions } from './screens-common.js';
import { Invoices, Payments, Customers, getBusiness, uid } from './db.js';
import { computeTotals, effectiveStatus, STATUS_META, STATUSES, rangeFor } from './model.js';
import { money, fmtDate, fmtDateInput, parseDateInput, relativeDays, addDays } from './format.js';
import { printInvoice, downloadInvoiceHTML, downloadInvoicePDF, emailInvoice, shareInvoice, invoiceHTML } from './invoice-doc.js';
import { parseInvoiceText } from './intelligence.js';

// ---------------- LIST ----------------
export async function invoicesScreen(params = {}) {
  const data = await loadAccountData();
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });
  let statusFilter = params.status || 'all';
  let sortBy = 'date';
  let query = '';

  const enriched = data.invoices.map(inv => {
    const pays = data.payments.filter(p => p.invoiceId === inv.id);
    const t = computeTotals(inv, pays);
    return { inv, t, status: effectiveStatus(inv, t) };
  });

  function render() {
    host.innerHTML = '';
    host.appendChild(pageHeader('Invoices', { actions: h('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate('/invoices/new') }, icon('plus', 16), 'New') }));

    const search = textInput({ placeholder: 'Search number, customer, amount…', value: query, oninput: e => { query = e.target.value; drawList(); } });
    host.appendChild(h('div', { class: 'search-bar' }, icon('search', 18), search));

    const filters = h('div', { class: 'chip-row' });
    const opts = [['all', 'All'], ['open', 'Open'], ['overdue', 'Overdue'], ['pending', 'Pending'], ['partially_paid', 'Partial'], ['paid', 'Paid'], ['draft', 'Draft'], ['sent', 'Sent'], ['cancelled', 'Cancelled']];
    for (const [k, label] of opts) filters.appendChild(h('button', { class: 'chip' + (statusFilter === k ? ' on' : ''), onclick: () => { statusFilter = k; drawList(); paintChips(); } }, label));
    host.appendChild(filters);
    function paintChips() { [...filters.children].forEach((c, i) => c.classList.toggle('on', opts[i][0] === statusFilter)); }

    const sortRow = h('div', { class: 'sort-row' },
      h('span', { class: 'muted small' }, 'Sort:'),
      selectInput([['date', 'Newest'], ['old', 'Oldest'], ['amount', 'Amount (high)'], ['amount_asc', 'Amount (low)'], ['due', 'Due date'], ['customer', 'Customer']].map(([v, l]) => ({ value: v, label: l })), { value: sortBy, onchange: e => { sortBy = e.target.value; drawList(); } }),
    );
    host.appendChild(sortRow);

    const listHost = h('div', { class: 'list-host' });
    host.appendChild(listHost);
    host.appendChild(h('div', { class: 'bottom-pad' }));

    function drawList() {
      let rows = enriched.slice();
      if (statusFilter === 'open') rows = rows.filter(r => ['sent', 'viewed', 'pending', 'partially_paid', 'overdue'].includes(r.status));
      else if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
      if (query) {
        const q = query.toLowerCase();
        rows = rows.filter(r => (r.inv.number || '').toLowerCase().includes(q) || (r.inv.customerSnapshot?.name || '').toLowerCase().includes(q) || String(r.t.total).includes(q) || (r.inv.lineItems || []).some(li => (li.name || '').toLowerCase().includes(q)));
      }
      rows.sort((a, b) => {
        switch (sortBy) {
          case 'old': return (a.inv.issueDate || 0) - (b.inv.issueDate || 0);
          case 'amount': return b.t.total - a.t.total;
          case 'amount_asc': return a.t.total - b.t.total;
          case 'due': return (a.inv.dueDate || 0) - (b.inv.dueDate || 0);
          case 'customer': return (a.inv.customerSnapshot?.name || '').localeCompare(b.inv.customerSnapshot?.name || '');
          default: return (b.inv.issueDate || 0) - (a.inv.issueDate || 0);
        }
      });
      listHost.innerHTML = '';
      // summary bar
      const sum = rows.reduce((s, r) => s + r.t.total, 0);
      const bal = rows.reduce((s, r) => s + r.t.balance, 0);
      listHost.appendChild(h('div', { class: 'list-summary' }, h('span', {}, `${rows.length} invoice(s)`), h('span', {}, `Total ${m(sum)} · Due ${m(bal)}`)));
      if (!rows.length) { listHost.appendChild(h('div', { class: 'empty pad' }, h('div', { class: 'empty-ico' }, icon('invoice', 28)), h('h3', {}, 'No invoices found'), h('p', { class: 'muted' }, 'Try a different filter, or create one.'), h('button', { class: 'btn btn-primary', onclick: () => navigate('/invoices/new') }, 'Create invoice'))); return; }
      const list = h('div', { class: 'list' });
      for (const { inv, t, status } of rows) {
        list.appendChild(h('div', { class: 'list-row', onclick: () => navigate('/invoices/' + inv.id) },
          h('div', { class: 'list-main' },
            h('div', { class: 'list-title' }, inv.customerSnapshot?.name || 'Customer'),
            h('div', { class: 'list-sub' }, `${inv.number} · ${fmtDate(inv.issueDate)}` + (status !== 'paid' && inv.dueDate ? ` · due ${relativeDays(inv.dueDate)}` : '')),
          ),
          h('div', { class: 'list-end' },
            h('div', { class: 'list-amt' }, m(t.total)),
            t.balance > 0 && t.paid > 0 ? h('div', { class: 'list-sub small' }, m(t.balance) + ' due') : null,
            statusPill(status),
          ),
        ));
      }
      listHost.appendChild(list);
    }
    drawList();
  }
  render();
  return host;
}

// ---------------- DETAIL ----------------
export async function invoiceDetailScreen({ id }) {
  const data = await loadAccountData();
  const inv = data.invoices.find(i => i.id === id);
  if (!inv) return notFoundCard('Invoice not found');
  const biz = data.business;
  const cur = inv.currency || biz?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });

  function payments() { return data.payments.filter(p => p.invoiceId === inv.id); }

  function render() {
    host.innerHTML = '';
    const pays = payments();
    const t = computeTotals(inv, pays);
    const status = effectiveStatus(inv, t);
    host.appendChild(pageHeader(inv.number || 'Invoice', { back: '/invoices', actions: h('button', { class: 'icon-btn', onclick: showMore }, icon('more', 22)) }));

    // Status + balance hero
    host.appendChild(h('div', { class: 'card detail-hero' },
      h('div', { class: 'detail-hero-top' }, statusPill(status), h('div', { class: 'muted small' }, 'Issued ' + fmtDate(inv.issueDate))),
      h('div', { class: 'detail-balance' }, h('div', { class: 'muted small' }, t.balance > 0 ? 'Balance due' : 'Total'), h('div', { class: 'detail-balance-val' }, m(t.balance > 0 ? t.balance : t.total))),
      inv.dueDate ? h('div', { class: 'muted small' }, (status === 'overdue' ? '⚠️ Overdue — was due ' : 'Due ') + fmtDate(inv.dueDate) + ` (${relativeDays(inv.dueDate)})`) : null,
    ));

    // Primary actions
    host.appendChild(h('div', { class: 'action-grid' },
      actionBtn('wallet', 'Record payment', () => recordPayment(inv, cur, () => reloadPays(render)), t.balance <= 0),
      actionBtn('eye', 'Preview', () => navigate('/invoices/' + inv.id + '/preview')),
      actionBtn('edit', 'Edit', () => navigate('/invoices/' + inv.id + '/edit')),
      actionBtn('download', 'Download PDF', () => doDownloadPdf(inv, biz, pays)),
    ));

    // Customer
    const c = inv.customerSnapshot || {};
    host.appendChild(section('Bill to', h('div', { class: 'card' },
      h('div', { class: 'kv' }, h('strong', {}, c.name || 'Customer')),
      c.company ? h('div', { class: 'muted small' }, c.company) : null,
      c.email ? h('div', { class: 'muted small' }, c.email) : null,
      c.phone ? h('div', { class: 'muted small' }, c.phone) : null,
      c.address ? h('div', { class: 'muted small pre' }, c.address) : null,
      c.id ? h('button', { class: 'btn btn-text btn-sm', onclick: () => navigate('/customers/' + c.id) }, 'View customer →') : null,
    )));

    // Line items
    const itemsCard = h('div', { class: 'card' });
    for (const li of (inv.lineItems || [])) {
      itemsCard.appendChild(h('div', { class: 'li-detail' },
        h('div', {}, h('div', { class: 'li-name' }, li.name), li.description ? h('div', { class: 'muted small' }, li.description) : null,
          h('div', { class: 'muted small' }, `${li.qty} × ${m(li.price)}` + (li.discountPct ? ` · -${li.discountPct}%` : '') + (li.taxable ? '' : ' · no tax'))),
        h('div', { class: 'li-amt' }, m(li._lineTotal)),
      ));
    }
    itemsCard.appendChild(totalsBlock(t, m, biz));
    host.appendChild(section('Items', itemsCard));

    // Payments
    const payCard = h('div', { class: 'card' });
    if (!pays.length) payCard.appendChild(h('div', { class: 'muted small center pad-sm' }, 'No payments recorded yet.'));
    else for (const p of pays.sort((a, b) => (b.date || 0) - (a.date || 0))) {
      payCard.appendChild(h('div', { class: 'li-detail' },
        h('div', {}, h('div', {}, p.method || 'Payment'), h('div', { class: 'muted small' }, fmtDate(p.date || p.createdAt) + (p.note ? ' · ' + p.note : ''))),
        h('div', { class: 'row-gap' }, h('div', { class: 'li-amt emerald' }, m(p.amount)),
          h('button', { class: 'icon-btn sm', onclick: async () => { if (await confirmDialog({ title: 'Delete payment?', message: 'This payment record will be removed.', confirmText: 'Delete', danger: true })) { await Payments.remove(p.id); await reloadPays(render); toast('Payment removed', 'success'); } } }, icon('trash', 16))),
      ));
    }
    host.appendChild(section(`Payments (${m(t.paid)} of ${m(t.total)})`, payCard));

    if (inv.notes || inv.terms) {
      const notesCard = h('div', { class: 'card' });
      if (inv.notes) notesCard.appendChild(h('div', { class: 'kv' }, h('div', { class: 'muted small strong' }, 'Notes'), h('div', { class: 'pre' }, inv.notes)));
      if (inv.terms) notesCard.appendChild(h('div', { class: 'kv' }, h('div', { class: 'muted small strong' }, 'Terms'), h('div', { class: 'pre' }, inv.terms)));
      host.appendChild(section('Notes & terms', notesCard));
    }

    host.appendChild(h('div', { class: 'bottom-pad' }));
  }

  async function reloadPays() { data.payments = await Payments.list(state.account.id); render(); }

  function showMore() {
    const rows = [
      ['mail', 'Email invoice', () => doEmailInvoice(inv, biz, payments())],
      ['print', 'Print', () => printInvoice(inv, biz, payments())],
      ['share', 'Share', async () => { const ok = await shareInvoice(inv, biz, payments()); if (!ok) { downloadInvoiceHTML(inv, biz, payments()); toast('Sharing not supported here — downloaded instead', 'info'); } }],
      ['file', 'Download (HTML)', () => { downloadInvoiceHTML(inv, biz, payments()); toast('Invoice downloaded', 'success'); }],
      ['copy', 'Duplicate', () => duplicateInvoice(inv)],
      ['refresh', 'Change status', () => changeStatus(inv, render)],
      ['trash', 'Delete invoice', async () => { if (await confirmDialog({ title: 'Delete invoice?', message: `${inv.number} will be permanently removed. This cannot be undone.`, confirmText: 'Delete', danger: true })) { for (const p of payments()) await Payments.remove(p.id); await Invoices.remove(inv.id); toast('Invoice deleted', 'success'); navigate('/invoices'); } }, true],
    ];
    const body = h('div', { class: 'menu-list' });
    for (const [ic, label, fn, danger] of rows) body.appendChild(h('button', { class: 'menu-item' + (danger ? ' danger' : ''), onclick: () => { mm.close(); fn(); } }, icon(ic, 18), label));
    const mm = modal({ title: 'Invoice options', size: 'sm', body });
  }

  async function doDownloadPdf(inv, biz, pays) {
    toast('Generating PDF…', 'info', 1800);
    try { await downloadInvoicePDF(inv, biz, pays); toast('PDF downloaded', 'success'); }
    catch (e) { console.error(e); toast('Could not generate PDF — try Print instead', 'error'); }
  }
  async function doEmailInvoice(inv, biz, pays) {
    toast('Preparing invoice…', 'info', 1800);
    try {
      const res = await emailInvoice(inv, biz, pays);
      if (res.mode === 'mailto-download') toast('PDF downloaded — attach it in the email that opened', 'info', 4200);
      else if (res.ok) toast('Ready to send', 'success');
    } catch (e) { console.error(e); toast('Could not prepare email — try Download PDF instead', 'error'); }
  }
  render();
  return host;
}

function totalsBlock(t, m, biz) {
  const wrap = h('div', { class: 'totals-block' });
  wrap.appendChild(totRow('Subtotal', m(t.subtotal)));
  if (t.discount) wrap.appendChild(totRow('Discount', '-' + m(t.discount)));
  if (t.tax) wrap.appendChild(totRow(`${biz?.taxLabel || 'Tax'} (${t.taxRate}%)`, m(t.tax)));
  wrap.appendChild(totRow('Total', m(t.total), 'grand'));
  if (t.paid) wrap.appendChild(totRow('Paid', '-' + m(t.paid)));
  wrap.appendChild(totRow('Balance due', m(t.balance), 'bal'));
  return wrap;
}
function totRow(label, val, cls = '') { return h('div', { class: 'tot ' + cls }, h('span', {}, label), h('span', {}, val)); }
function section(title, body) { return h('div', { class: 'detail-section' }, h('div', { class: 'detail-section-title' }, title), body); }
function actionBtn(ic, label, onclick, disabled) { return h('button', { class: 'act', disabled: !!disabled, onclick }, h('span', { class: 'act-ico' }, icon(ic, 20)), h('span', {}, label)); }
function notFoundCard(msg) { return h('div', { class: 'screen' }, pageHeader('Not found', { back: '/invoices' }), h('div', { class: 'card center pad' }, h('p', { class: 'muted' }, msg))); }

async function duplicateInvoice(inv) {
  const { saveBusiness } = await import('./db.js');
  const biz = await getBusiness(state.account.id);
  const copy = JSON.parse(JSON.stringify(inv));
  delete copy.id; delete copy.createdAt; delete copy.updatedAt;
  copy.number = (biz.numberingPrefix || 'INV-') + (biz.nextNumber || 1001);
  copy.status = 'draft';
  copy.issueDate = Date.now();
  copy.dueDate = addDays(Date.now(), biz.paymentTerms || 14);
  copy.lineItems = (copy.lineItems || []).map(li => ({ ...li, id: uid('li_') }));
  const saved = await Invoices.save(copy, state.account.id);
  biz.nextNumber = (biz.nextNumber || 1001) + 1;
  await saveBusiness(biz);
  toast('Duplicated as ' + copy.number, 'success');
  navigate('/invoices/' + saved.id + '/edit');
}

function changeStatus(inv, cb) {
  const body = h('div', { class: 'menu-list' });
  for (const s of ['draft', 'sent', 'viewed', 'pending', 'cancelled']) {
    body.appendChild(h('button', { class: 'menu-item', onclick: async () => { inv.status = s; await Invoices.save(inv, state.account.id); mm.close(); toast('Status set to ' + STATUS_META[s].label, 'success'); cb(); } }, statusPill(s), STATUS_META[s].label));
  }
  body.appendChild(h('p', { class: 'muted small pad-sm' }, 'Paid / Partially Paid / Overdue are set automatically from payments and due date.'));
  const mm = modal({ title: 'Change status', size: 'sm', body });
}

export function recordPayment(inv, cur, onSaved) {
  const pays = []; // computed by caller; recompute balance live
  const m = v => money(v, cur);
  const form = { amount: '', method: 'Bank Transfer', date: fmtDateInput(Date.now()), note: '' };
  const balEl = h('div', { class: 'muted small' });
  const amountInput = textInput({ type: 'number', step: '0.01', placeholder: '0.00', value: form.amount, oninput: e => (form.amount = e.target.value) });
  const body = h('div', {},
    fieldRow('Amount', amountInput),
    fieldRow('Method', selectInput(['Bank Transfer', 'Cash', 'Card', 'Cheque', 'Online', 'Other'].map(x => ({ value: x, label: x })), { value: form.method, onchange: e => (form.method = e.target.value) })),
    fieldRow('Date', textInput({ type: 'date', value: form.date, onchange: e => (form.date = e.target.value) })),
    fieldRow('Note (optional)', textInput({ placeholder: 'Reference…', oninput: e => (form.note = e.target.value) })),
  );
  const mm = modal({
    title: 'Record payment', size: 'sm', body,
    actions: frag(
      h('button', { class: 'btn btn-ghost', onclick: () => mm.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: async () => {
        const amt = parseFloat(form.amount);
        if (!amt || amt <= 0) return toast('Enter a valid amount', 'warn');
        await Payments.save({ accountId: state.account.id, invoiceId: inv.id, amount: amt, method: form.method, date: parseDateInput(form.date), note: form.note }, state.account.id);
        if (inv.status === 'draft') { inv.status = 'sent'; await Invoices.save(inv, state.account.id); }
        mm.close(); toast('Payment recorded', 'success'); onSaved && onSaved();
      } }, 'Save payment'),
    ),
  });
  // quick "mark fully paid" helper
  body.appendChild(h('button', { class: 'btn btn-text btn-sm', onclick: () => { const t = computeTotals(inv, []); amountInput.value = t.total; form.amount = String(t.total); } }, 'Fill full amount'));
}

// ---------------- EDITOR ----------------
export async function invoiceEditorScreen({ id }) {
  const data = await loadAccountData();
  const biz = data.business || {};
  const cur = biz.currency || 'USD';
  const m = v => money(v, cur);
  const isNew = !id;
  let inv;
  if (isNew) {
    inv = {
      number: (biz.numberingPrefix || 'INV-') + (biz.nextNumber || 1001),
      customerId: null, customerSnapshot: null,
      issueDate: Date.now(), dueDate: addDays(Date.now(), biz.paymentTerms || 14),
      lineItems: [], taxRate: biz.taxRate || 0, taxInclusive: !!biz.taxInclusive,
      discountType: 'none', discountValue: 0, depositRequested: 0, currency: cur,
      notes: biz.defaultNotes || '', terms: biz.defaultTerms || '', status: 'draft',
    };
    const preId = sessionStorage.getItem('snapbill.newInvoiceCustomer');
    if (preId) {
      sessionStorage.removeItem('snapbill.newInvoiceCustomer');
      const c = data.customers.find(x => x.id === preId);
      if (c) { inv.customerId = c.id; inv.customerSnapshot = { id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, address: c.address }; }
    }
  } else {
    inv = JSON.parse(JSON.stringify(data.invoices.find(i => i.id === id)));
    if (!inv) return notFoundCard('Invoice not found');
  }

  const host = h('div', { class: 'screen scroll' });

  function render() {
    host.innerHTML = '';
    host.appendChild(pageHeader(isNew ? 'New invoice' : 'Edit ' + inv.number, { back: isNew ? '/invoices' : '/invoices/' + id, actions: isNew ? h('button', { class: 'btn btn-ghost btn-sm', onclick: openNL }, icon('sparkles', 16), 'AI') : null }));

    // Customer
    const custCard = h('div', { class: 'card' });
    const drawCust = () => {
      custCard.innerHTML = '';
      const c = inv.customerSnapshot;
      if (c) {
        custCard.append(
          h('div', { class: 'picked' }, h('div', {}, h('strong', {}, c.name), c.company ? h('div', { class: 'muted small' }, c.company) : null, c.email ? h('div', { class: 'muted small' }, c.email) : null),
            h('button', { class: 'btn btn-text btn-sm', onclick: () => pickCustomer(inv, drawCust) }, 'Change')),
        );
      } else {
        custCard.append(
          h('button', { class: 'btn btn-ghost btn-block', onclick: () => pickCustomer(inv, drawCust) }, icon('users', 18), 'Select saved customer'),
          h('div', { class: 'divider small' }, h('span', {}, 'or enter manually')),
          manualCustomer(inv, drawCust),
        );
      }
    };
    drawCust();
    host.appendChild(sec('Customer', custCard));

    // Invoice meta
    host.appendChild(sec('Details', h('div', { class: 'card' },
      h('div', { class: 'grid-2' },
        fieldRow('Invoice number', textInput({ value: inv.number, oninput: e => (inv.number = e.target.value) })),
        fieldRow('Status', selectInput(['draft', 'sent', 'viewed', 'pending'].map(s => ({ value: s, label: STATUS_META[s].label })), { value: inv.status, onchange: e => (inv.status = e.target.value) })),
      ),
      h('div', { class: 'grid-2' },
        fieldRow('Issue date', textInput({ type: 'date', value: fmtDateInput(inv.issueDate), onchange: e => (inv.issueDate = parseDateInput(e.target.value)) })),
        fieldRow('Due date', textInput({ type: 'date', value: fmtDateInput(inv.dueDate), onchange: e => (inv.dueDate = parseDateInput(e.target.value)) })),
      ),
    )));

    // Line items
    const itemsCard = h('div', { class: 'card' });
    const drawItems = () => {
      itemsCard.innerHTML = '';
      if (!inv.lineItems.length) itemsCard.appendChild(h('div', { class: 'muted small center pad-sm' }, 'No items yet. Add one below.'));
      inv.lineItems.forEach((li, idx) => itemsCard.appendChild(lineEditor(li, () => { inv.lineItems.splice(idx, 1); drawItems(); drawTotals(); }, drawTotals, m)));
      itemsCard.appendChild(h('div', { class: 'add-item-row' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { inv.lineItems.push({ id: uid('li_'), name: '', description: '', qty: 1, price: 0, taxable: true }); drawItems(); } }, icon('plus', 16), 'Blank line'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => pickFromCatalog(data, inv, drawItems, drawTotals) }, icon('tag', 16), 'From catalog'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => pickPackage(data, inv, drawItems, drawTotals) }, icon('box', 16), 'Add package'),
      ));
    };
    drawItems();
    host.appendChild(sec('Items', itemsCard));

    // Adjustments
    host.appendChild(sec('Tax, discount & deposit', h('div', { class: 'card' },
      h('div', { class: 'grid-2' },
        fieldRow(`${biz.taxLabel || 'Tax'} rate (%)`, textInput({ type: 'number', step: '0.01', value: inv.taxRate, oninput: e => { inv.taxRate = parseFloat(e.target.value) || 0; drawTotals(); } })),
        fieldRow('Deposit requested', textInput({ type: 'number', step: '0.01', value: inv.depositRequested, oninput: e => { inv.depositRequested = parseFloat(e.target.value) || 0; drawTotals(); } })),
      ),
      h('div', { class: 'grid-2' },
        fieldRow('Discount type', selectInput([['none', 'None'], ['percent', 'Percentage'], ['amount', 'Fixed amount']].map(([v, l]) => ({ value: v, label: l })), { value: inv.discountType, onchange: e => { inv.discountType = e.target.value; drawTotals(); } })),
        fieldRow('Discount value', textInput({ type: 'number', step: '0.01', value: inv.discountValue, disabled: inv.discountType === 'none', oninput: e => { inv.discountValue = parseFloat(e.target.value) || 0; drawTotals(); } })),
      ),
    )));

    // Totals live
    const totalsCard = h('div', { class: 'card totals-live' });
    function drawTotals() { totalsCard.innerHTML = ''; const t = computeTotals(inv, []); totalsCard.appendChild(totalsBlock(t, m, biz)); }
    drawTotals();
    host.appendChild(sec('Totals', totalsCard));

    // Notes
    host.appendChild(sec('Notes & terms', h('div', { class: 'card' },
      fieldRow('Notes', textArea({ value: inv.notes, oninput: e => (inv.notes = e.target.value) })),
      fieldRow('Terms', textArea({ value: inv.terms, oninput: e => (inv.terms = e.target.value) })),
    )));

    host.appendChild(stickyActions(
      h('button', { class: 'btn btn-ghost', onclick: () => save('draft') }, 'Save draft'),
      h('button', { class: 'btn btn-primary', onclick: () => save('sent') }, isNew ? 'Save & mark sent' : 'Save'),
    ));
    host.appendChild(h('div', { class: 'bottom-pad-lg' }));
  }

  function openNL() { nlInvoiceModal(data, (draft) => { applyDraft(inv, draft, biz); render(); toast('Draft created — review & save', 'success'); }); }

  async function save(mode) {
    if (!inv.customerSnapshot) { toast('Please select or enter a customer', 'warn'); return; }
    if (!inv.lineItems.length) { toast('Add at least one item', 'warn'); return; }
    if (mode === 'sent' && inv.status === 'draft') inv.status = 'sent';
    const saved = await Invoices.save(inv, state.account.id);
    if (isNew) {
      const b = await getBusiness(state.account.id);
      const numTail = parseInt(String(inv.number).replace(/\D/g, ''), 10);
      b.nextNumber = Math.max((b.nextNumber || 1001) + 1, (numTail || 0) + 1);
      await import('./db.js').then(mod => mod.saveBusiness(b));
    }
    toast('Invoice saved', 'success');
    navigate('/invoices/' + saved.id);
  }

  render();
  return host;
}

function sec(title, body) { return h('div', { class: 'detail-section' }, h('div', { class: 'detail-section-title' }, title), body); }

function manualCustomer(inv, redraw) {
  const c = { name: '', company: '', email: '', phone: '', address: '' };
  const box = h('div', {},
    fieldRow('Name / company', textInput({ placeholder: 'Customer name', oninput: e => (c.name = e.target.value) })),
    h('div', { class: 'grid-2' },
      fieldRow('Email', textInput({ type: 'email', oninput: e => (c.email = e.target.value) })),
      fieldRow('Phone', textInput({ oninput: e => (c.phone = e.target.value) })),
    ),
    fieldRow('Billing address', textArea({ rows: 2, oninput: e => (c.address = e.target.value) })),
    h('button', { class: 'btn btn-primary btn-sm', onclick: () => { if (!c.name.trim()) return toast('Enter a customer name', 'warn'); inv.customerSnapshot = { ...c, company: c.company || '' }; redraw(); } }, 'Use this customer'),
  );
  return box;
}

function pickCustomer(inv, redraw) {
  Customers.list(state.account.id).then(list => {
    pickerModal({
      title: 'Select customer', items: list, searchKeys: ['name', 'company', 'email'],
      emptyText: 'No saved customers yet.',
      render: c => h('div', { class: 'picker-row' }, h('div', {}, h('div', { class: 'picker-title' }, c.name), h('div', { class: 'muted small' }, c.company || c.email || '')), icon('arrowRight', 16)),
      onPick: c => { inv.customerId = c.id; inv.customerSnapshot = { id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, address: c.address }; redraw(); },
      footer: h('button', { class: 'btn btn-ghost btn-block', onclick: () => { document.querySelector('.overlay')?.remove(); navigate('/customers/new'); } }, 'Create new customer'),
    });
  });
}

function pickFromCatalog(data, inv, drawItems, drawTotals) {
  pickerModal({
    title: 'Add from catalog', items: data.items, searchKeys: ['name', 'category'],
    emptyText: 'No saved products/services. Add some under More → Products.',
    render: it => h('div', { class: 'picker-row' }, h('div', {}, h('div', { class: 'picker-title' }, it.name), h('div', { class: 'muted small' }, (it.category || '') + ' · ' + money(it.price, inv.currency))), icon('plus', 16)),
    onPick: it => { inv.lineItems.push({ id: uid('li_'), name: it.name, description: it.description || '', qty: 1, price: Number(it.price) || 0, taxable: it.taxable !== false, itemRef: it.id }); drawItems(); drawTotals(); },
  });
}
function pickPackage(data, inv, drawItems, drawTotals) {
  pickerModal({
    title: 'Add package', items: data.packages, searchKeys: ['name'],
    emptyText: 'No packages yet. Create one under More → Packages.',
    render: p => h('div', { class: 'picker-row' }, h('div', {}, h('div', { class: 'picker-title' }, p.name), h('div', { class: 'muted small' }, `${p.items?.length || 0} items · ${money(packagePrice(p), inv.currency)}`)), icon('plus', 16)),
    onPick: p => {
      // Expand package into editable lines; a package summary line carries the packageRef for analytics.
      const price = packagePrice(p);
      inv.lineItems.push({ id: uid('li_'), name: p.name, description: (p.items || []).map(i => i.name).join(', '), qty: 1, price, taxable: true, packageRef: p.id, packageName: p.name });
      drawItems(); drawTotals();
      toast(`Added "${p.name}" — customise freely`, 'success');
    },
  });
}
export function packagePrice(p) {
  if (p.price != null && p.price !== '') return Number(p.price);
  return (p.items || []).reduce((s, i) => s + Number(i.qty || 1) * Number(i.price || 0), 0);
}

function lineEditor(li, onRemove, onChange, m) {
  const total = h('div', { class: 'li-line-total' });
  const paint = () => { const lt = Number(li.qty || 0) * Number(li.price || 0) * (1 - (Number(li.discountPct || 0) / 100)); total.textContent = m(lt); };
  paint();
  return h('div', { class: 'line-edit' },
    h('div', { class: 'line-edit-top' },
      textInput({ class: 'input line-name', placeholder: 'Item name', value: li.name, oninput: e => (li.name = e.target.value) }),
      h('button', { class: 'icon-btn sm', onclick: onRemove }, icon('trash', 16)),
    ),
    textInput({ class: 'input line-desc', placeholder: 'Description (optional)', value: li.description || '', oninput: e => (li.description = e.target.value) }),
    h('div', { class: 'line-edit-grid' },
      qtyPrice('Qty', li.qty, v => { li.qty = v; paint(); onChange(); }),
      qtyPrice('Price', li.price, v => { li.price = v; paint(); onChange(); }),
      qtyPrice('Disc %', li.discountPct || 0, v => { li.discountPct = v; paint(); onChange(); }),
      h('label', { class: 'tax-toggle' }, h('input', { type: 'checkbox', checked: li.taxable !== false, onchange: e => { li.taxable = e.target.checked; onChange(); } }), h('span', {}, 'Tax')),
    ),
    h('div', { class: 'line-total-row' }, h('span', { class: 'muted small' }, 'Line total'), total),
  );
}
function qtyPrice(label, value, onset) {
  return h('label', { class: 'mini-field' }, h('span', {}, label), h('input', { class: 'input', type: 'number', step: '0.01', value, oninput: e => onset(parseFloat(e.target.value) || 0) }));
}

// NL invoice modal
function nlInvoiceModal(data, onDraft) {
  const ta = textArea({ rows: 3, placeholder: 'e.g. Create an invoice for Sarah\'s Bakery for two logo concepts at $300 each, due in 14 days' });
  const voiceBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => startVoice(ta) }, icon('mic', 16), 'Speak');
  const body = h('div', {},
    h('p', { class: 'muted small' }, 'Describe the invoice in plain language. Snapbill drafts it — you review before saving.'),
    ta, h('div', { class: 'row-gap' }, voiceBtn),
  );
  const mm = modal({
    title: 'AI invoice draft', size: 'md', body,
    actions: frag(
      h('button', { class: 'btn btn-ghost', onclick: () => mm.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: () => { const draft = parseInvoiceText(ta.value, { items: data.items }); if (!draft.lineItems.length) return toast('Could not parse items — try including a price', 'warn'); mm.close(); onDraft(draft); } }, 'Create draft'),
    ),
  });
}
function startVoice(ta) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Voice input not supported on this device', 'warn');
  const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false;
  rec.onresult = e => { ta.value = (ta.value ? ta.value + ' ' : '') + e.results[0][0].transcript; };
  rec.onerror = () => toast('Voice input failed', 'warn');
  rec.start(); toast('Listening…', 'info', 1500);
}

function applyDraft(inv, draft, biz) {
  if (draft.customerName && !inv.customerSnapshot) inv.customerSnapshot = { name: draft.customerName };
  for (const li of draft.lineItems) inv.lineItems.push({ id: uid('li_'), name: li.name, description: '', qty: li.qty, price: li.price, taxable: li.taxable !== false });
  if (draft.dueInDays != null) inv.dueDate = addDays(inv.issueDate, draft.dueInDays);
}

// ---------------- PREVIEW ----------------
export async function invoicePreviewScreen({ id }) {
  const data = await loadAccountData();
  const inv = data.invoices.find(i => i.id === id);
  if (!inv) return notFoundCard('Invoice not found');
  const pays = data.payments.filter(p => p.invoiceId === inv.id);
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Preview', { back: '/invoices/' + id, actions: frag(
    h('button', { class: 'icon-btn', 'aria-label': 'Email', onclick: async () => { toast('Preparing invoice…', 'info', 1800); try { const res = await emailInvoice(inv, data.business, pays); if (res.mode === 'mailto-download') toast('PDF downloaded — attach it in the email that opened', 'info', 4200); else toast('Ready to send', 'success'); } catch { toast('Could not prepare email', 'error'); } } }, icon('mail', 20)),
    h('button', { class: 'icon-btn', 'aria-label': 'Print', onclick: () => printInvoice(inv, data.business, pays) }, icon('print', 20)),
    h('button', { class: 'icon-btn', 'aria-label': 'Download PDF', onclick: async () => { toast('Generating PDF…', 'info', 1800); try { await downloadInvoicePDF(inv, data.business, pays); toast('PDF downloaded', 'success'); } catch { toast('Could not generate PDF', 'error'); } } }, icon('download', 20)),
  ) }));
  const frame = h('iframe', { class: 'inv-frame', srcdoc: invoiceHTML(inv, data.business, pays) });
  host.appendChild(h('div', { class: 'preview-wrap' }, frame));
  return host;
}

// Fix customer bridge properly per editor instance
