// Snapbill data layer — Supabase (Postgres + Auth) backend.
// Real accounts, real multi-device sync, database-enforced per-account privacy
// via Row Level Security (see supabase/schema.sql). The client library is
// vendored locally and lazy-loaded so the app shell still boots instantly.

const SUPABASE_URL = 'https://pctgqjelrwxgwpkvnufu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zYAgLGF2BLQM0E7V8J6x8A_1GFju1HT';

let _client = null;
let _clientPromise = null;

function loadSupabaseLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './js/vendor/supabase.min.js';
    s.onload = resolve; s.onerror = () => reject(new Error('Could not reach the Snapbill backend. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

export async function openDB() {
  if (_client) return _client;
  if (!_clientPromise) {
    _clientPromise = (async () => {
      await loadSupabaseLib();
      _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return _client;
    })();
  }
  return _clientPromise;
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function friendlyAuthError(error) {
  const msg = error && error.message || 'Something went wrong.';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/user already registered/i.test(msg)) return 'An account with this email already exists.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email (check your inbox) before signing in.';
  return msg;
}

function toAccount(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, ownerName: (user.user_metadata && user.user_metadata.owner_name) || '' };
}

// ---------- Auth ----------
export async function createAccount({ ownerName, email, password }) {
  const client = await openDB();
  const { data, error } = await client.auth.signUp({
    email: email.trim(), password,
    options: { data: { owner_name: ownerName.trim() } },
  });
  if (error) throw new Error(friendlyAuthError(error));
  if (!data.session) {
    const err = new Error('Account created — check your email to confirm it, then sign in.');
    err.needsConfirmation = true;
    throw err;
  }
  return toAccount(data.user);
}

export async function authenticate(email, password) {
  const client = await openDB();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error));
  return toAccount(data.user);
}

// Step 1 of password reset: sends a real email with a secure link.
export async function requestPasswordReset(email) {
  const client = await openDB();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
  if (error) throw new Error(friendlyAuthError(error));
}

// Step 2: called after the user clicks the emailed link and lands back in a recovery session.
export async function updatePassword(newPassword) {
  const client = await openDB();
  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new Error(friendlyAuthError(error));
  return toAccount(data.user);
}

export async function getSession() {
  const client = await openDB();
  const { data } = await client.auth.getSession();
  return data.session ? toAccount(data.session.user) : null;
}

export async function clearSession() {
  const client = await openDB();
  await client.auth.signOut();
}

// Fires on sign-in, sign-out, token refresh, and password-recovery link landings.
export async function onAuthEvent(cb) {
  const client = await openDB();
  client.auth.onAuthStateChange((event, session) => cb(event, session ? toAccount(session.user) : null));
}

// ---------- Row <-> app-object field mapping (snake_case DB columns <-> camelCase JS) ----------
function tsToIso(ts) { return ts ? new Date(ts).toISOString() : null; }
function isoToTs(iso) { return iso ? new Date(iso).getTime() : null; }

const MAPPERS = {
  business: {
    toRow: (o) => ({
      user_id: o.accountId, business_name: o.businessName || '', owner_name: o.ownerName || '', type: o.type || '',
      logo_data_url: o.logoDataUrl || '', email: o.email || '', phone: o.phone || '', address: o.address || '',
      currency: o.currency || 'USD', tax_label: o.taxLabel || 'Sales Tax', tax_rate: o.taxRate ?? 0, tax_inclusive: !!o.taxInclusive,
      numbering_prefix: o.numberingPrefix || 'INV-', next_number: o.nextNumber || 1001,
      payment_instructions: o.paymentInstructions || '', payment_terms: o.paymentTerms || 14,
      default_notes: o.defaultNotes || '', default_terms: o.defaultTerms || '', accent: o.accent || '#4F46E5',
    }),
    fromRow: (r) => !r ? null : ({
      id: r.id, accountId: r.user_id, businessName: r.business_name, ownerName: r.owner_name, type: r.type,
      logoDataUrl: r.logo_data_url, email: r.email, phone: r.phone, address: r.address, currency: r.currency,
      taxLabel: r.tax_label, taxRate: Number(r.tax_rate), taxInclusive: r.tax_inclusive, numberingPrefix: r.numbering_prefix,
      nextNumber: r.next_number, paymentInstructions: r.payment_instructions, paymentTerms: r.payment_terms,
      defaultNotes: r.default_notes, defaultTerms: r.default_terms, accent: r.accent,
      createdAt: isoToTs(r.created_at), updatedAt: isoToTs(r.updated_at),
    }),
  },
  customers: {
    toRow: (o) => ({ user_id: o.accountId, name: o.name || '', company: o.company || '', email: o.email || '', phone: o.phone || '', address: o.address || '', notes: o.notes || '' }),
    fromRow: (r) => !r ? null : ({ id: r.id, accountId: r.user_id, name: r.name, company: r.company, email: r.email, phone: r.phone, address: r.address, notes: r.notes, createdAt: isoToTs(r.created_at), updatedAt: isoToTs(r.updated_at) }),
  },
  items: {
    toRow: (o) => ({ user_id: o.accountId, name: o.name || '', category: o.category || '', description: o.description || '', price: o.price || 0, taxable: o.taxable !== false, unit: o.unit || 'each', type: o.type || 'service', notes: o.notes || '', image_data_url: o.imageDataUrl || '' }),
    fromRow: (r) => !r ? null : ({ id: r.id, accountId: r.user_id, name: r.name, category: r.category, description: r.description, price: Number(r.price), taxable: r.taxable, unit: r.unit, type: r.type, notes: r.notes, imageDataUrl: r.image_data_url, createdAt: isoToTs(r.created_at), updatedAt: isoToTs(r.updated_at) }),
  },
  packages: {
    toRow: (o) => ({ user_id: o.accountId, name: o.name || '', description: o.description || '', price: (o.price === '' || o.price == null) ? null : o.price, items: o.items || [] }),
    fromRow: (r) => !r ? null : ({ id: r.id, accountId: r.user_id, name: r.name, description: r.description, price: r.price == null ? '' : Number(r.price), items: r.items || [], createdAt: isoToTs(r.created_at), updatedAt: isoToTs(r.updated_at) }),
  },
  invoices: {
    toRow: (o) => ({
      user_id: o.accountId, number: o.number || '', customer_id: o.customerId || null, customer_snapshot: o.customerSnapshot || {},
      issue_date: tsToIso(o.issueDate), due_date: tsToIso(o.dueDate), line_items: o.lineItems || [],
      tax_rate: o.taxRate ?? 0, tax_inclusive: !!o.taxInclusive, discount_type: o.discountType || 'none', discount_value: o.discountValue || 0,
      deposit_requested: o.depositRequested || 0, currency: o.currency || 'USD', notes: o.notes || '', terms: o.terms || '', status: o.status || 'draft',
    }),
    fromRow: (r) => !r ? null : ({
      id: r.id, accountId: r.user_id, number: r.number, customerId: r.customer_id, customerSnapshot: r.customer_snapshot || {},
      issueDate: isoToTs(r.issue_date), dueDate: isoToTs(r.due_date), lineItems: r.line_items || [],
      taxRate: Number(r.tax_rate), taxInclusive: r.tax_inclusive, discountType: r.discount_type, discountValue: Number(r.discount_value),
      depositRequested: Number(r.deposit_requested), currency: r.currency, notes: r.notes, terms: r.terms, status: r.status,
      createdAt: isoToTs(r.created_at), updatedAt: isoToTs(r.updated_at),
    }),
  },
  payments: {
    toRow: (o) => ({ user_id: o.accountId, invoice_id: o.invoiceId, amount: o.amount, method: o.method || 'Other', date: tsToIso(o.date || Date.now()), note: o.note || '' }),
    fromRow: (r) => !r ? null : ({ id: r.id, accountId: r.user_id, invoiceId: r.invoice_id, amount: Number(r.amount), method: r.method, date: isoToTs(r.date), note: r.note, createdAt: isoToTs(r.created_at) }),
  },
};

// ---------- Business profile ----------
export async function getBusiness(accountId) {
  const client = await openDB();
  const { data, error } = await client.from('business').select('*').eq('user_id', accountId).maybeSingle();
  if (error) throw new Error(error.message);
  return MAPPERS.business.fromRow(data);
}
export async function saveBusiness(profile) {
  const client = await openDB();
  const row = MAPPERS.business.toRow(profile);
  const { data, error } = await client.from('business').upsert(row, { onConflict: 'user_id' }).select().single();
  if (error) throw new Error(error.message);
  return MAPPERS.business.fromRow(data);
}

// ---------- Generic scoped repositories ----------
export function repo(table) {
  const M = MAPPERS[table];
  return {
    list: async (accountId) => {
      const client = await openDB();
      const { data, error } = await client.from(table).select('*').eq('user_id', accountId).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(M.fromRow);
    },
    get: async (id) => {
      const client = await openDB();
      const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return M.fromRow(data);
    },
    save: async (rec, accountId) => {
      const client = await openDB();
      const row = M.toRow({ ...rec, accountId: accountId || rec.accountId });
      if (rec.id) {
        const { data, error } = await client.from(table).update(row).eq('id', rec.id).select().single();
        if (error) throw new Error(error.message);
        return M.fromRow(data);
      }
      const { data, error } = await client.from(table).insert(row).select().single();
      if (error) throw new Error(error.message);
      return M.fromRow(data);
    },
    remove: async (id) => {
      const client = await openDB();
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}

export const Customers = repo('customers');
export const Items = repo('items');
export const Packages = repo('packages');
export const Invoices = repo('invoices');
export const Payments = repo('payments');

// ---------- Export / account deletion ----------
export async function exportAccountData(accountId) {
  const [business, customers, items, packages, invoices, payments] = await Promise.all([
    getBusiness(accountId), Customers.list(accountId), Items.list(accountId),
    Packages.list(accountId), Invoices.list(accountId), Payments.list(accountId),
  ]);
  const client = await openDB();
  const { data } = await client.auth.getUser();
  const user = data && data.user;
  const safeAccount = user ? { id: user.id, email: user.email, ownerName: (user.user_metadata || {}).owner_name || '' } : null;
  return { exportedAt: new Date().toISOString(), app: 'Snapbill', account: safeAccount, business, customers, items, packages, invoices, payments };
}

// Wipes all of the signed-in user's business data and signs them out. Note: fully
// deleting the underlying login (auth.users row) requires elevated (service_role)
// access that the browser's public key intentionally cannot have — that row can be
// removed from the Supabase Dashboard (Authentication -> Users) if ever needed.
export async function deleteAccountData(accountId) {
  const client = await openDB();
  const tables = ['payments', 'invoices', 'packages', 'items', 'customers', 'business'];
  for (const t of tables) {
    const { error } = await client.from(t).delete().eq('user_id', accountId);
    if (error) throw new Error(error.message);
  }
}
