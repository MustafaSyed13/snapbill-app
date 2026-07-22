// Snapbill data layer — IndexedDB storage, per-account isolation, auth, analytics.
// Cloud-sync (Supabase) can be layered on top of the same repository API later.

const DB_NAME = 'snapbill';
const DB_VERSION = 1;
const STORES = ['accounts', 'business', 'customers', 'items', 'packages', 'invoices', 'payments', 'meta'];

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (name !== 'accounts' && name !== 'meta') store.createIndex('accountId', 'accountId', { unique: false });
        }
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}
function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function put(store, value) { await openDB(); await reqP(tx(store, 'readwrite').put(value)); return value; }
export async function get(store, id) { await openDB(); return reqP(tx(store).get(id)); }
export async function del(store, id) { await openDB(); return reqP(tx(store, 'readwrite').delete(id)); }
export async function getAll(store) { await openDB(); return reqP(tx(store).getAll()); }

export async function getAllByAccount(store, accountId) {
  await openDB();
  const idx = tx(store).index('accountId');
  return reqP(idx.getAll(IDBKeyRange.only(accountId)));
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Auth (PBKDF2 via Web Crypto) ----------
const enc = new TextEncoder();
async function pbkdf2(password, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
function randSaltB64() {
  const s = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...s));
}
export async function hashSecret(secret) {
  const salt = randSaltB64();
  const hash = await pbkdf2(secret, salt);
  return { salt, hash };
}
export async function verifySecret(secret, salt, hash) {
  const h = await pbkdf2(secret, salt);
  return h === hash;
}

export async function findAccountByEmail(email) {
  const all = await getAll('accounts');
  return all.find(a => a.email.toLowerCase() === email.toLowerCase().trim());
}

export async function createAccount({ ownerName, email, password, securityQuestion, securityAnswer }) {
  const existing = await findAccountByEmail(email);
  if (existing) throw new Error('An account with this email already exists.');
  const { salt, hash } = await hashSecret(password);
  const sa = await hashSecret((securityAnswer || '').toLowerCase().trim());
  const account = {
    id: uid('acc_'), ownerName: ownerName.trim(), email: email.trim(),
    salt, hash, securityQuestion: securityQuestion || 'What city were you born in?',
    saSalt: sa.salt, saHash: sa.hash, createdAt: Date.now(),
  };
  await put('accounts', account);
  return account;
}

export async function authenticate(email, password) {
  const acc = await findAccountByEmail(email);
  if (!acc) throw new Error('No account found for that email.');
  const ok = await verifySecret(password, acc.salt, acc.hash);
  if (!ok) throw new Error('Incorrect password.');
  return acc;
}

export async function resetPassword(email, securityAnswer, newPassword) {
  const acc = await findAccountByEmail(email);
  if (!acc) throw new Error('No account found for that email.');
  const ok = await verifySecret((securityAnswer || '').toLowerCase().trim(), acc.saSalt, acc.saHash);
  if (!ok) throw new Error('Security answer does not match.');
  const { salt, hash } = await hashSecret(newPassword);
  acc.salt = salt; acc.hash = hash;
  await put('accounts', acc);
  return acc;
}

// ---------- Session ----------
const SESSION_KEY = 'snapbill.session';
export function setSession(accountId) { localStorage.setItem(SESSION_KEY, accountId); }
export function getSession() { return localStorage.getItem(SESSION_KEY); }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ---------- Business profile ----------
export async function getBusiness(accountId) {
  const all = await getAllByAccount('business', accountId);
  return all[0] || null;
}
export async function saveBusiness(profile) {
  if (!profile.id) profile.id = uid('biz_');
  profile.updatedAt = Date.now();
  return put('business', profile);
}

// ---------- Generic scoped repositories ----------
export function repo(store) {
  return {
    list: (accountId) => getAllByAccount(store, accountId),
    get: (id) => get(store, id),
    save: async (rec, accountId) => {
      if (!rec.id) rec.id = uid(store.slice(0, 3) + '_');
      if (accountId) rec.accountId = accountId;
      rec.updatedAt = Date.now();
      if (!rec.createdAt) rec.createdAt = Date.now();
      return put(store, rec);
    },
    remove: (id) => del(store, id),
  };
}

export const Customers = repo('customers');
export const Items = repo('items');
export const Packages = repo('packages');
export const Invoices = repo('invoices');
export const Payments = repo('payments');

// ---------- Account deletion / export ----------
export async function exportAccountData(accountId) {
  const [business, customers, items, packages, invoices, payments] = await Promise.all([
    getBusiness(accountId), Customers.list(accountId), Items.list(accountId),
    Packages.list(accountId), Invoices.list(accountId), Payments.list(accountId),
  ]);
  const acc = await get('accounts', accountId);
  const safeAccount = acc ? { id: acc.id, ownerName: acc.ownerName, email: acc.email, createdAt: acc.createdAt } : null;
  return { exportedAt: new Date().toISOString(), app: 'Snapbill', account: safeAccount, business, customers, items, packages, invoices, payments };
}

export async function deleteAccountData(accountId) {
  const stores = ['business', 'customers', 'items', 'packages', 'invoices', 'payments'];
  for (const s of stores) {
    const recs = await getAllByAccount(s, accountId);
    for (const r of recs) await del(s, r.id);
  }
  await del('accounts', accountId);
}
