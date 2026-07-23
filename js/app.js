// Snapbill app shell: bootstrap, routing, layout, guards, theme.
import { h, icon, state, route, navigate, startRouter, currentPath, onRoute, toast, spinner, clear } from './lib.js';
import { openDB, getSession, getBusiness, onAuthEvent, clearSession } from './db.js';
import { setDisplayCurrency } from './format.js';

// Screens
import { welcomeScreen, registerScreen, loginScreen, recoverScreen, resetPasswordScreen, setupScreen } from './screens-auth.js';
import { dashboardScreen } from './screens-dashboard.js';
import { invoicesScreen, invoiceDetailScreen, invoiceEditorScreen, invoicePreviewScreen } from './screens-invoices.js';
import { customersScreen, customerDetailScreen, customerEditScreen } from './screens-customers.js';
import { itemsScreen, packagesScreen, packageEditScreen } from './screens-catalog.js';
import { analyticsScreen, assistantScreen, notificationsScreen } from './screens-insights.js';
import { moreScreen, profileScreen, taxScreen, appearanceScreen, accountScreen, exportScreen, writingScreen, helpScreen } from './screens-settings.js';

const AUTH_ROUTES = ['/welcome', '/login', '/register', '/recover'];
const app = document.getElementById('app');

// ---------- Theme ----------
export function getTheme() { return localStorage.getItem('snapbill.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
export function setTheme(t) { localStorage.setItem('snapbill.theme', t); applyTheme(); }
function applyTheme() { document.documentElement.dataset.theme = getTheme(); }

// ---------- Layout ----------
function buildShell() {
  app.innerHTML = '';
  const view = h('main', { id: 'view', class: 'view' });
  const nav = buildNav();
  app.append(view, nav);
  return view;
}
function buildNav() {
  const nav = h('nav', { id: 'bottom-nav', class: 'bottom-nav' });
  const items = [
    ['/', 'home', 'Home'],
    ['/invoices', 'invoice', 'Invoices'],
    ['__create', 'plus', 'Create'],
    ['/customers', 'users', 'Customers'],
    ['/more', 'menu', 'More'],
  ];
  for (const [path, ic, label] of items) {
    if (path === '__create') {
      nav.appendChild(h('button', { class: 'nav-fab', 'aria-label': 'Create invoice', onclick: () => navigate('/invoices/new') }, icon(ic, 26)));
      continue;
    }
    nav.appendChild(h('button', { class: 'nav-item', dataset: { path }, onclick: () => navigate(path) }, icon(ic, 22), h('span', {}, label)));
  }
  return nav;
}
function updateNav(path) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  const authed = !!state.account && !AUTH_ROUTES.includes(path) && path !== '/setup';
  nav.style.display = authed ? '' : 'none';
  document.body.classList.toggle('has-nav', authed);
  const base = '/' + (path.split('/').filter(Boolean)[0] || '');
  nav.querySelectorAll('.nav-item').forEach(el => {
    const p = el.dataset.path;
    el.classList.toggle('on', p === '/' ? path === '/' : base === p);
  });
}

// ---------- Route mounting ----------
let view;
let mountToken = 0;
async function mount(fn, params) {
  const token = ++mountToken;
  view = document.getElementById('view');
  clear(view);
  view.appendChild(spinner());
  try {
    const node = await fn(params);
    if (token !== mountToken) return; // a newer navigation has since started; discard this stale render
    clear(view);
    view.appendChild(node);
    view.scrollTop = 0;
  } catch (err) {
    if (token !== mountToken) return;
    console.error(err);
    clear(view);
    view.appendChild(h('div', { class: 'screen pad' }, h('h2', {}, 'Something went wrong'), h('p', { class: 'muted' }, err.message), h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Reload')));
  }
}

function guard(fn, { needsAuth = true, needsBusiness = true } = {}) {
  return async (params) => {
    if (needsAuth && !state.account) return navigate('/welcome', { replace: true });
    if (needsAuth && needsBusiness && !state.business) return navigate('/setup', { replace: true });
    if (state.business) setDisplayCurrency(state.business.currency || 'USD');
    await mount(fn, params);
  };
}

function defineRoutes() {
  // Public
  route('/welcome', () => publicMount(welcomeScreen));
  route('/login', () => publicMount(loginScreen));
  route('/register', () => publicMount(registerScreen));
  route('/recover', () => publicMount(recoverScreen));
  route('/reset-password', async () => { await mount(resetPasswordScreen); });
  route('/setup', async () => { if (!state.account) return navigate('/welcome', { replace: true }); await mount(setupScreen); });

  // App
  route('/', guard(dashboardScreen));
  route('/invoices', guard(invoicesScreen));
  route('/invoices/new', guard(invoiceEditorScreen));
  route('/invoices/:id', guard(invoiceDetailScreen));
  route('/invoices/:id/edit', guard(({ id }) => invoiceEditorScreen({ id })));
  route('/invoices/:id/preview', guard(invoicePreviewScreen));
  route('/customers', guard(customersScreen));
  route('/customers/new', guard(customerEditScreen));
  route('/customers/:id', guard(customerDetailScreen));
  route('/customers/:id/edit', guard(({ id }) => customerEditScreen({ id })));
  route('/items', guard(itemsScreen));
  route('/packages', guard(packagesScreen));
  route('/packages/new', guard(packageEditScreen));
  route('/packages/:id/edit', guard(({ id }) => packageEditScreen({ id })));
  route('/analytics', guard(analyticsScreen));
  route('/assistant', guard(assistantScreen));
  route('/writing', guard(writingScreen));
  route('/notifications', guard(notificationsScreen));
  route('/more', guard(moreScreen));
  route('/profile', guard(profileScreen));
  route('/settings/tax', guard(taxScreen));
  route('/settings/appearance', guard(appearanceScreen));
  route('/settings/account', guard(accountScreen));
  route('/export', guard(exportScreen));
  route('/help', guard(helpScreen));
}
async function publicMount(fn) {
  // If already logged in and hitting a public page, go home
  if (state.account && state.business) return navigate('/', { replace: true });
  await mount(fn);
}

onRoute(updateNav);

// ---------- Boot ----------
async function boot() {
  applyTheme();
  try {
    await openDB();
    const acc = await getSession();
    if (acc) { const biz = await getBusiness(acc.id); state.set({ account: acc, business: biz }); if (biz) setDisplayCurrency(biz.currency || 'USD'); }
  } catch (e) {
    console.error(e);
    toast('Could not reach the Snapbill backend — check your internet connection', 'error', 5000);
  }
  buildShell();
  defineRoutes();

  // Initial route
  const path = currentPath();
  if (path.split('?')[0] === '/reset-password') { /* let the recovery-link route through untouched */ }
  else if (!state.account && !AUTH_ROUTES.includes(path.split('?')[0])) navigate('/welcome', { replace: true });
  else if (state.account && !state.business && path !== '/setup') navigate('/setup', { replace: true });
  else if (path === '/' && !location.hash) navigate('/', { replace: true });

  startRouter();

  // React to auth changes (sign in/out) by refreshing nav
  state.subscribe(() => updateNav(currentPath()));

  // Supabase fires 'PASSWORD_RECOVERY' when a user lands back via the emailed reset link.
  onAuthEvent((event, acc) => {
    if (event === 'PASSWORD_RECOVERY') { state.set({ account: acc }); navigate('/reset-password'); }
    else if (event === 'SIGNED_OUT') { state.set({ account: null, business: null }); }
  });

  // Register service worker for offline + install
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Update available — reopen to refresh', 'info', 4000); });
      });
    } catch (e) { /* offline still works via cache on next load */ }
  }
}

// Online/offline indicator — Snapbill's data lives in the cloud, so saving/loading needs a connection.
window.addEventListener('offline', () => toast('You are offline — reconnect to load or save data', 'warn', 3500));
window.addEventListener('online', () => toast('Back online', 'success', 1800));

boot();
