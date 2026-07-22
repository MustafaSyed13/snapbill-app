// Customer screens: list, detail (with history & totals), editor.
import { h, icon, navigate, state, toast, confirmDialog } from './lib.js';
import { pageHeader, fieldRow, textInput, textArea, loadAccountData, statusPill, stickyActions } from './screens-common.js';
import { Customers, Invoices, Payments } from './db.js';
import { computeTotals, effectiveStatus } from './model.js';
import { money, fmtDate } from './format.js';

export async function customersScreen() {
  const data = await loadAccountData();
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });
  let query = '';

  const stats = {};
  for (const c of data.customers) stats[c.id] = { billed: 0, paid: 0, count: 0, last: 0 };
  for (const inv of data.invoices) {
    const cid = inv.customerId; if (!cid || !stats[cid]) continue;
    const t = computeTotals(inv, data.payments.filter(p => p.invoiceId === inv.id));
    stats[cid].billed += t.total; stats[cid].paid += t.paid; stats[cid].count++;
    stats[cid].last = Math.max(stats[cid].last, inv.issueDate || 0);
  }

  function render() {
    host.innerHTML = '';
    host.appendChild(pageHeader('Customers', { actions: h('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate('/customers/new') }, icon('plus', 16), 'New') }));
    host.appendChild(h('div', { class: 'search-bar' }, icon('search', 18), textInput({ placeholder: 'Search customers…', value: query, oninput: e => { query = e.target.value; draw(); } })));
    const listHost = h('div', {}); host.appendChild(listHost); host.appendChild(h('div', { class: 'bottom-pad' }));
    function draw() {
      let rows = data.customers.slice();
      if (query) { const q = query.toLowerCase(); rows = rows.filter(c => [c.name, c.company, c.email, c.phone].some(f => (f || '').toLowerCase().includes(q))); }
      rows.sort((a, b) => (stats[b.id]?.billed || 0) - (stats[a.id]?.billed || 0));
      listHost.innerHTML = '';
      if (!rows.length) { listHost.appendChild(h('div', { class: 'empty pad' }, h('div', { class: 'empty-ico' }, icon('users', 28)), h('h3', {}, data.customers.length ? 'No matches' : 'No customers yet'), h('p', { class: 'muted' }, 'Save customers to reuse them on invoices.'), h('button', { class: 'btn btn-primary', onclick: () => navigate('/customers/new') }, 'Add customer'))); return; }
      const list = h('div', { class: 'list' });
      for (const c of rows) {
        const s = stats[c.id] || { billed: 0, count: 0 };
        list.appendChild(h('div', { class: 'list-row', onclick: () => navigate('/customers/' + c.id) },
          h('div', { class: 'avatar-sm' }, (c.name || '?').slice(0, 1).toUpperCase()),
          h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, c.name), h('div', { class: 'list-sub' }, c.company || c.email || '—')),
          h('div', { class: 'list-end' }, h('div', { class: 'list-amt' }, m(s.billed)), h('div', { class: 'list-sub small' }, `${s.count} inv`)),
        ));
      }
      listHost.appendChild(list);
    }
    draw();
  }
  render();
  return host;
}

export async function customerDetailScreen({ id }) {
  const data = await loadAccountData();
  const c = data.customers.find(x => x.id === id);
  if (!c) return h('div', { class: 'screen' }, pageHeader('Not found', { back: '/customers' }), h('div', { class: 'card center pad' }, h('p', { class: 'muted' }, 'Customer not found')));
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const invs = data.invoices.filter(i => i.customerId === id).sort((a, b) => (b.issueDate || 0) - (a.issueDate || 0));
  let billed = 0, paid = 0, outstanding = 0;
  const itemCount = {};
  for (const inv of invs) {
    const t = computeTotals(inv, data.payments.filter(p => p.invoiceId === inv.id));
    billed += t.total; paid += t.paid; outstanding += t.balance;
    for (const li of (inv.lineItems || [])) itemCount[li.name] = (itemCount[li.name] || 0) + Number(li.qty || 0);
  }
  const favItems = Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const lastPurchase = invs[0]?.issueDate;

  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader(c.name, { back: '/customers', actions: h('button', { class: 'icon-btn', onclick: () => navigate('/customers/' + id + '/edit') }, icon('edit', 20)) }));

  host.appendChild(h('div', { class: 'card' },
    h('div', { class: 'cust-head' }, h('div', { class: 'avatar-lg' }, (c.name || '?').slice(0, 1).toUpperCase()),
      h('div', {}, h('div', { class: 'cust-name' }, c.name), c.company ? h('div', { class: 'muted small' }, c.company) : null)),
    h('div', { class: 'contact-row' },
      c.email ? contact('mail', c.email, 'mailto:' + c.email) : null,
      c.phone ? contact('phone', c.phone, 'tel:' + c.phone) : null,
    ),
    c.address ? h('div', { class: 'muted small pre pad-sm' }, c.address) : null,
    c.notes ? h('div', { class: 'note-box' }, c.notes) : null,
  ));

  host.appendChild(h('div', { class: 'stat-grid three' },
    miniStat('Invoiced', m(billed)), miniStat('Paid', m(paid)), miniStat('Outstanding', m(outstanding)),
  ));
  host.appendChild(h('div', { class: 'card list' },
    kvRow('Total invoices', String(invs.length)),
    kvRow('Last purchase', lastPurchase ? fmtDate(lastPurchase) : '—'),
    kvRow('Frequently bought', favItems.length ? favItems.map(f => f[0]).join(', ') : '—'),
  ));

  host.appendChild(h('button', { class: 'btn btn-primary btn-block', onclick: () => { sessionStorage.setItem('snapbill.newInvoiceCustomer', id); navigate('/invoices/new'); } }, icon('plus', 18), 'New invoice for ' + c.name.split(' ')[0]));

  host.appendChild(h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Invoice history')));
  if (!invs.length) host.appendChild(h('div', { class: 'card muted center pad' }, 'No invoices yet.'));
  else {
    const list = h('div', { class: 'list' });
    for (const inv of invs) {
      const t = computeTotals(inv, data.payments.filter(p => p.invoiceId === inv.id));
      const st = effectiveStatus(inv, t);
      list.appendChild(h('div', { class: 'list-row', onclick: () => navigate('/invoices/' + inv.id) },
        h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, inv.number), h('div', { class: 'list-sub' }, fmtDate(inv.issueDate))),
        h('div', { class: 'list-end' }, h('div', { class: 'list-amt' }, m(t.total)), statusPill(st))));
    }
    host.appendChild(list);
  }

  host.appendChild(h('button', { class: 'btn btn-text btn-block danger', onclick: async () => {
    if (invs.length) return toast('Cannot delete a customer with invoices', 'warn');
    if (await confirmDialog({ title: 'Delete customer?', message: `${c.name} will be removed.`, confirmText: 'Delete', danger: true })) { await Customers.remove(id); toast('Customer deleted', 'success'); navigate('/customers'); }
  } }, 'Delete customer'));
  host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;
}

function contact(ic, text, href) { return h('a', { class: 'contact-chip', href }, icon(ic, 16), text); }
function miniStat(label, val) { return h('div', { class: 'stat stat-default' }, h('div', { class: 'stat-body' }, h('div', { class: 'stat-value sm' }, val), h('div', { class: 'stat-label' }, label))); }
function kvRow(k, v) { return h('div', { class: 'list-row' }, h('div', { class: 'muted' }, k), h('div', { class: 'strong' }, v)); }

export async function customerEditScreen({ id }) {
  const isNew = !id;
  let c = { name: '', company: '', email: '', phone: '', address: '', notes: '' };
  if (!isNew) { const existing = await Customers.get(id); if (!existing) return h('div', {}, pageHeader('Not found', { back: '/customers' })); c = { ...existing }; }
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader(isNew ? 'New customer' : 'Edit customer', { back: isNew ? '/customers' : '/customers/' + id }));
  host.appendChild(h('div', { class: 'card' },
    fieldRow('Name *', textInput({ value: c.name, placeholder: 'Full name', oninput: e => (c.name = e.target.value) })),
    fieldRow('Company', textInput({ value: c.company, oninput: e => (c.company = e.target.value) })),
    h('div', { class: 'grid-2' },
      fieldRow('Email', textInput({ type: 'email', value: c.email, oninput: e => (c.email = e.target.value) })),
      fieldRow('Phone', textInput({ value: c.phone, oninput: e => (c.phone = e.target.value) })),
    ),
    fieldRow('Billing address', textArea({ value: c.address, oninput: e => (c.address = e.target.value) })),
    fieldRow('Notes', textArea({ value: c.notes, oninput: e => (c.notes = e.target.value) })),
  ));
  host.appendChild(stickyActions(
    h('button', { class: 'btn btn-ghost', onclick: () => history.back() }, 'Cancel'),
    h('button', { class: 'btn btn-primary', onclick: async () => {
      if (!c.name.trim()) return toast('Name is required', 'warn');
      const saved = await Customers.save(c, state.account.id);
      toast('Customer saved', 'success');
      navigate('/customers/' + saved.id);
    } }, 'Save customer'),
  ));
  host.appendChild(h('div', { class: 'bottom-pad-lg' }));
  return host;
}
