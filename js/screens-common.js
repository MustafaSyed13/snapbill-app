// Shared building blocks for screens.
import { h, icon, navigate, state, modal, frag, toast } from './lib.js';
import { money, fmtDate } from './format.js';
import { STATUS_META } from './model.js';
import { getBusiness, Customers, Items, Packages, Invoices, Payments } from './db.js';

export function pageHeader(title, opts = {}) {
  return h('div', { class: 'page-head' },
    opts.back ? h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => (typeof opts.back === 'string' ? navigate(opts.back) : history.back()) }, icon('arrowLeft', 22)) : null,
    h('h1', { class: 'page-title' }, title),
    opts.actions ? h('div', { class: 'page-actions' }, opts.actions) : null,
  );
}

export function textInput(props = {}) {
  return h('input', { class: 'input', type: props.type || 'text', ...props });
}
export function textArea(props = {}) {
  return h('textarea', { class: 'input textarea', rows: props.rows || 3, ...props });
}
export function selectInput(options, props = {}) {
  const sel = h('select', { class: 'input', ...props });
  for (const o of options) {
    const opt = h('option', { value: o.value }, o.label);
    if (String(o.value) === String(props.value)) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}
export function fieldRow(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null,
  );
}

export function statusPill(status) {
  const m = STATUS_META[status] || { label: status, color: 'slate' };
  return h('span', { class: `pill pill-${m.color}` }, m.label);
}

export async function loadAccountData() {
  const aid = state.account.id;
  const [business, customers, items, packages, invoices, payments] = await Promise.all([
    getBusiness(aid), Customers.list(aid), Items.list(aid), Packages.list(aid), Invoices.list(aid), Payments.list(aid),
  ]);
  return { business, customers, items, packages, invoices, payments };
}

export function paymentsFor(payments, invoiceId) {
  return payments.filter(p => p.invoiceId === invoiceId);
}

// Bottom action bar for forms
export function stickyActions(...children) {
  return h('div', { class: 'sticky-actions' }, ...children);
}

// Simple searchable picker modal
export function pickerModal({ title, items, render, onPick, searchKeys = ['name'], emptyText = 'Nothing found', footer }) {
  const listHost = h('div', { class: 'picker-list' });
  const draw = (q) => {
    listHost.innerHTML = '';
    const filtered = !q ? items : items.filter(it => searchKeys.some(k => String(it[k] || '').toLowerCase().includes(q.toLowerCase())));
    if (!filtered.length) { listHost.appendChild(h('div', { class: 'muted center pad' }, emptyText)); return; }
    for (const it of filtered) {
      const row = render(it);
      row.addEventListener('click', () => { m.close(); onPick(it); });
      listHost.appendChild(row);
    }
  };
  const search = textInput({ placeholder: 'Search…', oninput: e => draw(e.target.value) });
  const m = modal({
    title, size: 'md',
    body: frag(h('div', { class: 'picker-search' }, icon('search', 18), search), listHost),
    actions: footer || null,
  });
  draw('');
  setTimeout(() => search.focus(), 100);
  return m;
}

export function money2(v, cur) { return money(v, cur); }

// Reusable stat tile
export function statTile({ label, value, sub, tone = 'default', iconName }) {
  return h('div', { class: `stat stat-${tone}` },
    iconName ? h('div', { class: 'stat-ico' }, icon(iconName, 18)) : null,
    h('div', { class: 'stat-body' },
      h('div', { class: 'stat-value' }, value),
      h('div', { class: 'stat-label' }, label),
      sub ? h('div', { class: 'stat-sub' }, sub) : null,
    ),
  );
}

// Tiny SVG bar chart
export function barChart(series, opts = {}) {
  const max = Math.max(1, ...series.map(s => s.value));
  const wrap = h('div', { class: 'chart' });
  for (const s of series) {
    const pct = Math.round((s.value / max) * 100);
    wrap.appendChild(h('div', { class: 'chart-col' },
      h('div', { class: 'chart-bar-wrap' }, h('div', { class: 'chart-bar', style: { height: Math.max(3, pct) + '%' }, title: opts.fmt ? opts.fmt(s.value) : s.value })),
      h('div', { class: 'chart-label' }, s.label),
    ));
  }
  return wrap;
}

// Donut for paid/outstanding/overdue split
export function donut(segments, centerLabel, centerValue) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const size = 120, r = 46, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('class', 'donut');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', cx); bg.setAttribute('cy', cy); bg.setAttribute('r', r);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'var(--line)'); bg.setAttribute('stroke-width', 14);
  svg.appendChild(bg);
  let offset = 0;
  for (const s of segments) {
    if (s.value <= 0) continue;
    const frac = s.value / total;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', s.color); c.setAttribute('stroke-width', 14);
    c.setAttribute('stroke-dasharray', `${circ * frac} ${circ}`);
    c.setAttribute('stroke-dashoffset', -circ * offset);
    c.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    c.setAttribute('stroke-linecap', 'round');
    svg.appendChild(c);
    offset += frac;
  }
  return h('div', { class: 'donut-wrap' }, svg,
    h('div', { class: 'donut-center' }, h('div', { class: 'donut-value' }, centerValue), h('div', { class: 'donut-label' }, centerLabel)));
}
