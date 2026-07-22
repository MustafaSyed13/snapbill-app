// "More" hub + settings: profile, tax/currency, appearance, export, account, writing, help.
import { h, icon, navigate, state, toast, modal, frag, confirmDialog } from './lib.js';
import { pageHeader, fieldRow, textInput, textArea, selectInput, loadAccountData, stickyActions } from './screens-common.js';
import { getBusiness, saveBusiness, exportAccountData, deleteAccountData, clearSession, Customers, Invoices } from './db.js';
import { CURRENCIES } from './format.js';
import { logoUploader, colorPicker } from './screens-auth.js';
import { setAiConfig, aiConfig, aiAvailable, writeText } from './intelligence.js';
import { setTheme, getTheme } from './app.js';

export async function moreScreen() {
  const data = await loadAccountData();
  const biz = data.business || {};
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('More'));
  host.appendChild(h('div', { class: 'card profile-card', onclick: () => navigate('/profile') },
    biz.logoDataUrl ? h('img', { class: 'profile-logo', src: biz.logoDataUrl }) : h('div', { class: 'profile-logo ph' }, (biz.businessName || 'S').slice(0, 1).toUpperCase()),
    h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, biz.businessName || 'Your business'), h('div', { class: 'list-sub' }, state.account.email)),
    icon('arrowRight', 18),
  ));

  const groups = [
    ['Catalog', [
      ['tag', 'Products & services', '/items'],
      ['box', 'Packages', '/packages'],
    ]],
    ['Insights', [
      ['chart', 'Sales analytics', '/analytics'],
      ['sparkles', 'Business assistant', '/assistant'],
      ['sparkles', 'Writing assistant', '/writing'],
      ['bell', 'Notifications', '/notifications'],
    ]],
    ['Settings', [
      ['building', 'Business profile', '/profile'],
      ['percent', 'Tax & currency', '/settings/tax'],
      ['invoice', 'Invoice appearance', '/settings/appearance'],
      ['settings', 'Account settings', '/settings/account'],
    ]],
    ['Data', [
      ['download', 'Export & backup', '/export'],
      ['info', 'Help & install', '/help'],
    ]],
  ];
  for (const [title, rows] of groups) {
    host.appendChild(h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, title)));
    const card = h('div', { class: 'card list' });
    for (const [ic, label, path] of rows) card.appendChild(h('div', { class: 'list-row', onclick: () => navigate(path) }, h('div', { class: 'menu-ico' }, icon(ic, 18)), h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, label)), icon('arrowRight', 16)));
    host.appendChild(card);
  }

  // Theme toggle
  const themeIcoHost = h('div', { class: 'menu-ico' }, icon(getTheme() === 'dark' ? 'moon' : 'sun', 18));
  host.appendChild(h('div', { class: 'card list' },
    h('div', { class: 'list-row' }, themeIcoHost, h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, 'Dark mode')),
      toggle(getTheme() === 'dark', on => { setTheme(on ? 'dark' : 'light'); themeIcoHost.innerHTML = ''; themeIcoHost.appendChild(icon(on ? 'moon' : 'sun', 18)); })),
  ));

  host.appendChild(h('button', { class: 'btn btn-ghost btn-block danger', onclick: async () => { if (await confirmDialog({ title: 'Sign out?', message: 'You can sign back in any time. Your data stays on this device.', confirmText: 'Sign out' })) { clearSession(); state.set({ account: null, business: null }); navigate('/welcome'); } } }, icon('logout', 18), 'Sign out'));
  host.appendChild(h('div', { class: 'muted small center pad' }, 'Snapbill · v1.0 · Data stored on this device'));
  host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;
}

function toggle(on, onchange) {
  const el = h('button', { class: 'toggle' + (on ? ' on' : ''), onclick: () => { on = !on; el.classList.toggle('on', on); onchange(on); } }, h('span', { class: 'knob' }));
  return el;
}

// ---------- Business profile ----------
export async function profileScreen() {
  const b = { ...(await getBusiness(state.account.id) || {}) };
  b.accountId = state.account.id;
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Business profile', { back: '/more' }));
  host.appendChild(h('div', { class: 'card' }, logoUploader(b)));
  host.appendChild(h('div', { class: 'card' },
    fieldRow('Business name', textInput({ value: b.businessName || '', oninput: e => (b.businessName = e.target.value) })),
    fieldRow('Owner name', textInput({ value: b.ownerName || '', oninput: e => (b.ownerName = e.target.value) })),
    fieldRow('Type of business', textInput({ value: b.type || '', oninput: e => (b.type = e.target.value) })),
    fieldRow('Business email', textInput({ type: 'email', value: b.email || '', oninput: e => (b.email = e.target.value) })),
    fieldRow('Phone', textInput({ value: b.phone || '', oninput: e => (b.phone = e.target.value) })),
    fieldRow('Address', textArea({ value: b.address || '', oninput: e => (b.address = e.target.value) })),
    fieldRow('Payment instructions', textArea({ value: b.paymentInstructions || '', oninput: e => (b.paymentInstructions = e.target.value) })),
  ));
  host.appendChild(stickyActions(
    h('button', { class: 'btn btn-ghost', onclick: () => navigate('/more') }, 'Back'),
    h('button', { class: 'btn btn-primary', onclick: async () => { await saveBusiness(b); state.set({ business: b }); toast('Profile saved', 'success'); navigate('/more'); } }, 'Save'),
  ));
  host.appendChild(h('div', { class: 'bottom-pad-lg' }));
  return host;
}

// ---------- Tax & currency ----------
export async function taxScreen() {
  const b = { ...(await getBusiness(state.account.id) || {}) };
  b.accountId = state.account.id;
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Tax & currency', { back: '/more' }));
  host.appendChild(h('div', { class: 'card' },
    fieldRow('Default currency', selectInput(Object.entries(CURRENCIES).map(([code, c]) => ({ value: code, label: `${code} — ${c.name}` })), { value: b.currency || 'USD', onchange: e => (b.currency = e.target.value) }), 'Applied to new invoices. Existing invoices keep their own currency.'),
    fieldRow('Tax label', textInput({ value: b.taxLabel || 'Sales Tax', oninput: e => (b.taxLabel = e.target.value) })),
    fieldRow('Default tax rate (%)', textInput({ type: 'number', step: '0.01', value: b.taxRate ?? 0, oninput: e => (b.taxRate = parseFloat(e.target.value) || 0) })),
    h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: !!b.taxInclusive, onchange: e => (b.taxInclusive = e.target.checked) }), h('span', {}, 'Prices include tax')),
    h('div', { class: 'grid-2' },
      fieldRow('Invoice prefix', textInput({ value: b.numberingPrefix || 'INV-', oninput: e => (b.numberingPrefix = e.target.value) })),
      fieldRow('Next number', textInput({ type: 'number', value: b.nextNumber || 1001, oninput: e => (b.nextNumber = parseInt(e.target.value) || 1001) })),
    ),
    fieldRow('Standard payment terms (days)', textInput({ type: 'number', value: b.paymentTerms || 14, oninput: e => (b.paymentTerms = parseInt(e.target.value) || 14) })),
  ));
  host.appendChild(stickyActions(h('button', { class: 'btn btn-ghost', onclick: () => navigate('/more') }, 'Back'), h('button', { class: 'btn btn-primary', onclick: async () => { await saveBusiness(b); state.set({ business: b }); toast('Saved', 'success'); navigate('/more'); } }, 'Save')));
  host.appendChild(h('div', { class: 'bottom-pad-lg' }));
  return host;
}

// ---------- Invoice appearance ----------
export async function appearanceScreen() {
  const b = { ...(await getBusiness(state.account.id) || {}) };
  b.accountId = state.account.id;
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Invoice appearance', { back: '/more' }));
  host.appendChild(h('div', { class: 'card' },
    fieldRow('Accent colour', colorPicker(b)),
    fieldRow('Default notes', textArea({ value: b.defaultNotes || '', oninput: e => (b.defaultNotes = e.target.value) })),
    fieldRow('Default terms', textArea({ value: b.defaultTerms || '', oninput: e => (b.defaultTerms = e.target.value) })),
  ));
  host.appendChild(h('div', { class: 'muted small pad-sm' }, 'Tip: your logo, colour, and business details appear automatically on every downloadable invoice.'));
  host.appendChild(stickyActions(h('button', { class: 'btn btn-ghost', onclick: () => navigate('/more') }, 'Back'), h('button', { class: 'btn btn-primary', onclick: async () => { await saveBusiness(b); state.set({ business: b }); toast('Saved', 'success'); navigate('/more'); } }, 'Save')));
  host.appendChild(h('div', { class: 'bottom-pad-lg' }));
  return host;
}

// ---------- Account settings (incl. optional AI) ----------
export async function accountScreen() {
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Account settings', { back: '/more' }));
  host.appendChild(h('div', { class: 'card list' },
    kv('Owner', state.account.ownerName), kv('Email', state.account.email), kv('Account ID', state.account.id.slice(0, 14) + '…'),
  ));

  // Optional AI
  const ai = aiConfig() || {};
  const cfg = { endpoint: ai.endpoint || '', apiKey: ai.apiKey || '', model: ai.model || 'gpt-4o-mini' };
  host.appendChild(h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Optional AI assistant')));
  host.appendChild(h('div', { class: 'card' },
    h('p', { class: 'muted small' }, 'Snapbill\'s assistant, insights, and invoice parsing work fully offline. You can optionally connect an OpenAI-compatible endpoint to make the writing assistant phrase things more naturally. Your key is stored only on this device.'),
    fieldRow('API endpoint', textInput({ value: cfg.endpoint, placeholder: 'https://api.openai.com/v1/chat/completions', oninput: e => (cfg.endpoint = e.target.value) })),
    fieldRow('API key', textInput({ type: 'password', value: cfg.apiKey, placeholder: 'sk-…', oninput: e => (cfg.apiKey = e.target.value) })),
    fieldRow('Model', textInput({ value: cfg.model, oninput: e => (cfg.model = e.target.value) })),
    h('div', { class: 'row-gap' },
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => { setAiConfig(cfg); toast('AI settings saved', 'success'); } }, 'Save'),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { setAiConfig({}); toast('AI disconnected — offline features still work', 'info'); navigate('/settings/account'); } }, 'Disconnect'),
    ),
    h('div', { class: 'muted small' }, aiAvailable() ? '● Connected' : '○ Not connected (using offline intelligence)'),
  ));

  host.appendChild(h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Danger zone')));
  host.appendChild(h('div', { class: 'card' },
    h('p', { class: 'muted small' }, 'Deleting your account removes all your invoices, customers, products, and packages from this device. Export a backup first if you want to keep a copy.'),
    h('button', { class: 'btn btn-danger btn-block', onclick: deleteFlow }, icon('trash', 16), 'Delete account & data'),
  ));
  host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;
}

async function deleteFlow() {
  const first = await confirmDialog({ title: 'Delete everything?', message: 'This permanently removes your account and all business data on this device. This cannot be undone.', confirmText: 'Continue', danger: true });
  if (!first) return;
  // export offer
  const doExport = await confirmDialog({ title: 'Download a backup first?', message: 'We recommend exporting your data before deleting.', confirmText: 'Yes, download backup' });
  if (doExport) await downloadBackup();
  const second = await confirmDialog({ title: 'Final confirmation', message: 'Type-safe check: really delete your account now?', confirmText: 'Delete forever', danger: true });
  if (!second) return;
  await deleteAccountData(state.account.id);
  clearSession(); state.set({ account: null, business: null });
  toast('Account deleted', 'success');
  navigate('/welcome');
}

// ---------- Export & backup ----------
export async function exportScreen() {
  const data = await loadAccountData();
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Export & backup', { back: '/more' }));
  host.appendChild(h('div', { class: 'card' },
    h('p', { class: 'muted small' }, 'Your data belongs to you. Download it any time in open formats — nothing is locked in.'),
    row('file', 'Full backup (JSON)', 'Everything — restore-ready', downloadBackup),
    row('invoice', 'Invoices (CSV)', `${data.invoices.length} invoice(s)`, () => exportInvoicesCSV(data)),
    row('users', 'Customers (CSV)', `${data.customers.length} customer(s)`, () => exportCustomersCSV(data)),
    row('tag', 'Products & services (CSV)', `${data.items.length} item(s)`, () => exportItemsCSV(data)),
  ));
  host.appendChild(h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Restore')));
  host.appendChild(h('div', { class: 'card' },
    h('p', { class: 'muted small' }, 'Restore a JSON backup exported from Snapbill. This adds the backed-up records to your current account.'),
    restoreControl(),
  ));
  host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;

  function row(ic, title, sub, onclick) {
    return h('div', { class: 'list-row', onclick }, h('div', { class: 'menu-ico' }, icon(ic, 18)), h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, title), h('div', { class: 'list-sub' }, sub)), icon('download', 18));
  }
}

function restoreControl() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onchange: async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup || backup.app !== 'Snapbill') throw new Error('Not a Snapbill backup file');
      const aid = state.account.id;
      const { Customers, Items, Packages, Invoices, Payments } = await import('./db.js');
      let n = 0;
      for (const c of backup.customers || []) { delete c.id; await Customers.save(c, aid); n++; }
      for (const it of backup.items || []) { delete it.id; await Items.save(it, aid); n++; }
      for (const p of backup.packages || []) { delete p.id; await Packages.save(p, aid); n++; }
      for (const inv of backup.invoices || []) { const old = inv.id; delete inv.id; const saved = await Invoices.save(inv, aid); for (const pay of (backup.payments || []).filter(p => p.invoiceId === old)) { delete pay.id; pay.invoiceId = saved.id; await Payments.save(pay, aid); } n++; }
      toast(`Restored ${n} record(s)`, 'success');
      navigate('/');
    } catch (err) { toast('Restore failed: ' + err.message, 'error'); }
  } });
  return h('div', {}, h('button', { class: 'btn btn-ghost btn-block', onclick: () => input.click() }, icon('refresh', 18), 'Choose backup file'), input);
}

export async function downloadBackup() {
  const data = await exportAccountData(state.account.id);
  downloadFile(JSON.stringify(data, null, 2), `snapbill-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  toast('Backup downloaded', 'success');
}
function exportInvoicesCSV(data) {
  import('./model.js').then(({ computeTotals, effectiveStatus }) => {
    const rows = [['Number', 'Customer', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance', 'Currency']];
    for (const inv of data.invoices) {
      const t = computeTotals(inv, data.payments.filter(p => p.invoiceId === inv.id));
      rows.push([inv.number, inv.customerSnapshot?.name || '', dateStr(inv.issueDate), dateStr(inv.dueDate), effectiveStatus(inv, t), t.subtotal, t.tax, t.total, t.paid, t.balance, inv.currency || data.business?.currency || 'USD']);
    }
    downloadFile(toCSV(rows), 'snapbill-invoices.csv', 'text/csv');
    toast('Invoices exported', 'success');
  });
}
function exportCustomersCSV(data) {
  const rows = [['Name', 'Company', 'Email', 'Phone', 'Address', 'Notes']];
  for (const c of data.customers) rows.push([c.name, c.company, c.email, c.phone, (c.address || '').replace(/\n/g, ' '), (c.notes || '').replace(/\n/g, ' ')]);
  downloadFile(toCSV(rows), 'snapbill-customers.csv', 'text/csv');
  toast('Customers exported', 'success');
}
function exportItemsCSV(data) {
  const rows = [['Name', 'Type', 'Category', 'Price', 'Unit', 'Taxable', 'Description']];
  for (const it of data.items) rows.push([it.name, it.type, it.category, it.price, it.unit, it.taxable !== false, (it.description || '').replace(/\n/g, ' ')]);
  downloadFile(toCSV(rows), 'snapbill-items.csv', 'text/csv');
  toast('Items exported', 'success');
}
function toCSV(rows) { return rows.map(r => r.map(cell => { const s = String(cell ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n'); }
function dateStr(ts) { return ts ? new Date(ts).toISOString().slice(0, 10) : ''; }
function downloadFile(content, name, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function kv(k, v) { return h('div', { class: 'list-row' }, h('div', { class: 'muted' }, k), h('div', { class: 'strong' }, v)); }

// ---------- Writing assistant ----------
export async function writingScreen() {
  const data = await loadAccountData();
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Writing assistant', { back: '/more' }));
  host.appendChild(h('p', { class: 'muted small pad-sm' }, 'Generate editable text you can copy into invoices or messages. Everything is a starting point — tweak freely.'));
  const kinds = [
    ['notes', 'Invoice notes', 'file'], ['terms', 'Payment terms', 'file'],
    ['reminder', 'Friendly payment reminder', 'mail'], ['overdue', 'Overdue notice', 'alert'],
    ['weekly', 'Weekly summary', 'chart'], ['monthly', 'Monthly summary', 'chart'],
  ];
  const grid = h('div', { class: 'card list' });
  for (const [kind, label, ic] of kinds) grid.appendChild(h('div', { class: 'list-row', onclick: () => openWriter(kind, label, data) }, h('div', { class: 'menu-ico' }, icon(ic, 18)), h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, label)), icon('arrowRight', 16)));
  host.appendChild(grid);
  host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;
}
function openWriter(kind, label, data) {
  const ctx = { business: data.business, account: state.account, invoices: data.invoices, payments: data.payments, days: data.business?.paymentTerms || 14 };
  const text = writeText(kind, ctx);
  const ta = textArea({ rows: 10, value: text });
  const body = h('div', {}, ta, h('div', { class: 'muted small' }, 'Edit as needed, then copy.'));
  const mm = modal({
    title: label, size: 'md', body,
    actions: frag(
      h('button', { class: 'btn btn-ghost', onclick: () => mm.close() }, 'Close'),
      h('button', { class: 'btn btn-primary', onclick: async () => { try { await navigator.clipboard.writeText(ta.value); toast('Copied to clipboard', 'success'); } catch { toast('Select and copy manually', 'info'); } } }, icon('copy', 16), 'Copy'),
    ),
  });
}

// ---------- Help & install ----------
export function helpScreen() {
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Help & install', { back: '/more' }));
  host.appendChild(h('div', { class: 'card help-card' },
    h('h3', {}, '📲 Install on your phone'),
    h('div', { class: 'help-step' }, h('strong', {}, 'iPhone / iPad (Safari):'), h('ol', {}, h('li', {}, 'Open this link in Safari'), h('li', {}, 'Tap the Share button'), h('li', {}, 'Tap "Add to Home Screen"'), h('li', {}, 'Tap "Add" — Snapbill appears like a native app'))),
    h('div', { class: 'help-step' }, h('strong', {}, 'Android (Chrome):'), h('ol', {}, h('li', {}, 'Open this link in Chrome'), h('li', {}, 'Tap the ⋮ menu'), h('li', {}, 'Tap "Install app" / "Add to Home screen"'), h('li', {}, 'Confirm — it installs to your home screen'))),
    h('div', { class: 'help-step' }, h('strong', {}, 'Desktop (Chrome/Edge):'), h('p', { class: 'muted small' }, 'Click the install icon in the address bar, or use the browser menu → "Install Snapbill".')),
  ));
  host.appendChild(h('div', { class: 'card help-card' },
    h('h3', {}, '💾 Where is my data?'),
    h('p', { class: 'muted small' }, 'Your data is stored securely on this device using your browser\'s database, isolated per account. It works offline. To move to another device, use Export & backup, then Restore on the new device. (Optional cloud sync can be enabled in a production upgrade — see the project README.)'),
  ));
  host.appendChild(h('div', { class: 'card help-card' },
    h('h3', {}, '🧠 Smart features'),
    h('p', { class: 'muted small' }, 'The assistant, insights, and AI invoice drafting work offline using your own data. Connecting an optional AI key (Account settings) only improves phrasing — nothing breaks without it.'),
  ));
  host.appendChild(h('div', { class: 'card help-card' },
    h('h3', {}, '🔒 Privacy'),
    h('p', { class: 'muted small' }, 'Each account\'s data is private and never shared with other accounts. No analytics or tracking. You can delete everything any time in Account settings.'),
  ));
  host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;
}
