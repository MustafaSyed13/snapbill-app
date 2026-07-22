// Minimal UI toolkit: hyperscript, router, toasts, modals, icons, app state.

// ---------- hyperscript ----------
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
      else el.setAttribute(k, v);
    }
  }
  appendChildren(el, children);
  return el;
}
function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function frag(...children) { const f = document.createDocumentFragment(); appendChildren(f, children); return f; }
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ---------- App state (simple pub/sub) ----------
export const state = {
  account: null, business: null, theme: 'light',
  _subs: new Set(),
  set(patch) { Object.assign(this, patch); this._subs.forEach(fn => fn(this)); },
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
};

// ---------- Router (hash based) ----------
const routes = [];
let notFound = null;
export function route(pattern, handler) { routes.push({ parts: pattern.split('/').filter(Boolean), handler }); }
export function setNotFound(fn) { notFound = fn; }
export function navigate(path, opts = {}) {
  if (opts.replace) location.replace('#' + path);
  else location.hash = path;
}
export function currentPath() { return location.hash.slice(1) || '/'; }

let _onRoute = null;
export function onRoute(fn) { _onRoute = fn; }

export function startRouter() {
  const handle = () => {
    const path = currentPath();
    const segs = path.split('?')[0].split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(path.split('?')[1] || ''));
    for (const r of routes) {
      if (r.parts.length !== segs.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < r.parts.length; i++) {
        if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(segs[i]);
        else if (r.parts[i] !== segs[i]) { ok = false; break; }
      }
      if (ok) { r.handler({ ...params, ...query, _query: query }); if (_onRoute) _onRoute(path); return; }
    }
    if (notFound) notFound();
  };
  window.addEventListener('hashchange', handle);
  handle();
}

// ---------- Toast ----------
export function toast(message, kind = 'info', ms = 2600) {
  let host = document.getElementById('toast-host');
  if (!host) { host = h('div', { id: 'toast-host', class: 'toast-host' }); document.body.appendChild(host); }
  const t = h('div', { class: `toast toast-${kind}` }, iconFor(kind), h('span', {}, message));
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, ms);
}
function iconFor(kind) {
  const map = { success: 'check-circle', error: 'alert', info: 'info', warn: 'alert' };
  return icon(map[kind] || 'info', 18);
}

// ---------- Modal / sheet ----------
export function modal({ title, body, actions, size = 'md', onClose }) {
  const overlay = h('div', { class: 'overlay' });
  const closeAll = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 220); if (onClose) onClose(); };
  const card = h('div', { class: `sheet sheet-${size}` },
    h('div', { class: 'sheet-head' },
      h('h3', {}, title || ''),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: closeAll }, icon('x', 20)),
    ),
    h('div', { class: 'sheet-body' }, body),
    actions ? h('div', { class: 'sheet-actions' }, actions) : null,
  );
  overlay.appendChild(card);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAll(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return { close: closeAll, el: card };
}

export function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    const m = modal({
      title, size: 'sm',
      body: h('p', { class: 'muted' }, message),
      actions: frag(
        h('button', { class: 'btn btn-ghost', onclick: () => { m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => { m.close(); resolve(true); } }, confirmText),
      ),
    });
  });
}

// ---------- Icons (inline SVG, stroke) ----------
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10',
  invoice: 'M7 3h10a2 2 0 012 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 012-2zM9 8h6M9 12h6M9 16h4',
  plus: 'M12 5v14M5 12h14',
  users: 'M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  menu: 'M3 12h18M3 6h18M3 18h18',
  x: 'M18 6L6 18M6 6l12 12',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  check: 'M20 6L9 17l-5-5',
  'check-circle': 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  alert: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z',
  share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  copy: 'M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
  trash: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z',
  wallet: 'M20 12V8H6a2 2 0 01-2-2 2 2 0 012-2h12v4M4 6v12a2 2 0 002 2h14v-4M18 12a2 2 0 000 4h4v-4h-4z',
  box: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12l8.73-5.04M12 22.08V12',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
  sparkles: 'M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15zM19 14l.6 1.8L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6L19 14z',
  mic: 'M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01',
  percent: 'M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  moon: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.68 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0122 16.92z',
  map: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  more: 'M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  cloud: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  cloudOff: 'M22.61 16.95A5 5 0 0018 10h-1.26a8 8 0 00-7.05-6M5 5a8 8 0 004 15h9a5 5 0 001.7-.3M1 1l22 22',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
};
export function icon(name, size = 20, opts = {}) {
  const p = ICONS[name] || ICONS.info;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', opts.weight || 2);
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('ico');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', p);
  svg.appendChild(path);
  return svg;
}

// ---------- Small components ----------
export function statusBadge(status, meta) {
  return h('span', { class: `badge badge-${meta.color}` }, meta.label);
}
export function field(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null,
  );
}
export function spinner(label) {
  return h('div', { class: 'loading' }, h('div', { class: 'spin' }), label ? h('span', {}, label) : null);
}
export function emptyState(iconName, title, sub, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-ico' }, icon(iconName, 30)),
    h('h3', {}, title), sub ? h('p', { class: 'muted' }, sub) : null,
    action || null,
  );
}
