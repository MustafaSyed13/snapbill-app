// Auth & onboarding screens: welcome, register, login, recover, business setup.
import { h, icon, navigate, state, toast, frag } from './lib.js';
import { fieldRow, textInput, textArea, selectInput, pageHeader } from './screens-common.js';
import { createAccount, authenticate, resetPassword, setSession, findAccountByEmail, getBusiness, saveBusiness } from './db.js';
import { CURRENCIES } from './format.js';
import { ensureDemoAccount, DEMO_EMAIL, DEMO_PASSWORD } from './seed.js';

function logoMark(size = 44) {
  return h('div', { class: 'brand-mark', style: { width: size + 'px', height: size + 'px' } }, icon('sparkles', size * 0.5));
}

export function welcomeScreen() {
  const view = h('div', { class: 'auth-screen' },
    h('div', { class: 'auth-hero' },
      h('div', { class: 'hero-badge' }, logoMark(56)),
      h('h1', { class: 'hero-title' }, 'Snapbill'),
      h('p', { class: 'hero-tag' }, 'Professional invoices in a snap.'),
      h('ul', { class: 'hero-points' },
        featureRow('invoice', 'Create polished invoices', 'Itemised charges, tax, discounts & your logo'),
        featureRow('wallet', 'Track every payment', 'Know exactly who owes you what'),
        featureRow('chart', 'Understand your business', 'Trends, top customers & smart insights'),
        featureRow('cloudOff', 'Works offline', 'Draft anywhere — installs like a real app'),
      ),
    ),
    h('div', { class: 'auth-cta' },
      h('button', { class: 'btn btn-primary btn-lg btn-block', onclick: () => navigate('/register') }, 'Create free account'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => navigate('/login') }, 'I already have an account'),
      h('button', { class: 'btn btn-text btn-block', onclick: tryDemo }, icon('sparkles', 16), 'Explore the demo'),
    ),
  );
  return view;
}
function featureRow(ic, title, sub) {
  return h('li', {}, h('span', { class: 'feat-ico' }, icon(ic, 20)),
    h('span', {}, h('strong', {}, title), h('span', { class: 'feat-sub' }, sub)));
}

async function tryDemo() {
  toast('Loading demo…', 'info', 1200);
  try {
    const acc = await ensureDemoAccount();
    setSession(acc.id);
    state.set({ account: acc, business: await getBusiness(acc.id) });
    navigate('/');
    toast('Welcome to the Snapbill demo', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

export function registerScreen() {
  const form = { ownerName: '', email: '', password: '', confirm: '', securityAnswer: '' };
  const err = h('div', { class: 'form-error' });
  const submit = async () => {
    err.textContent = '';
    if (!form.ownerName.trim()) return (err.textContent = 'Please enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return (err.textContent = 'Please enter a valid email.');
    if (form.password.length < 6) return (err.textContent = 'Password must be at least 6 characters.');
    if (form.password !== form.confirm) return (err.textContent = 'Passwords do not match.');
    if (!form.securityAnswer.trim()) return (err.textContent = 'Please answer the security question (for password reset).');
    try {
      const acc = await createAccount({ ...form, securityQuestion: 'What city were you born in?' });
      setSession(acc.id);
      state.set({ account: acc, business: null });
      toast('Account created', 'success');
      navigate('/setup');
    } catch (e) { err.textContent = e.message; }
  };
  return h('div', { class: 'auth-screen scroll' },
    authTop('Create your account', 'Start invoicing in minutes — no credit card required.'),
    h('div', { class: 'auth-form' },
      fieldRow('Your name', textInput({ placeholder: 'Jamie Carter', oninput: e => (form.ownerName = e.target.value) })),
      fieldRow('Email', textInput({ type: 'email', placeholder: 'you@business.com', oninput: e => (form.email = e.target.value) })),
      fieldRow('Password', textInput({ type: 'password', placeholder: 'At least 6 characters', oninput: e => (form.password = e.target.value) })),
      fieldRow('Confirm password', textInput({ type: 'password', placeholder: 'Re-enter password', oninput: e => (form.confirm = e.target.value) })),
      fieldRow('Security answer', textInput({ placeholder: 'What city were you born in?', oninput: e => (form.securityAnswer = e.target.value) }), 'Used to reset your password if you forget it.'),
      err,
      h('button', { class: 'btn btn-primary btn-lg btn-block', onclick: submit }, 'Create account'),
      h('p', { class: 'auth-alt' }, 'Already have an account? ', h('a', { onclick: () => navigate('/login') }, 'Sign in')),
    ),
  );
}

export function loginScreen() {
  const form = { email: '', password: '' };
  const err = h('div', { class: 'form-error' });
  const submit = async () => {
    err.textContent = '';
    try {
      const acc = await authenticate(form.email, form.password);
      setSession(acc.id);
      const biz = await getBusiness(acc.id);
      state.set({ account: acc, business: biz });
      toast('Welcome back', 'success');
      navigate(biz ? '/' : '/setup');
    } catch (e) { err.textContent = e.message; }
  };
  return h('div', { class: 'auth-screen scroll' },
    authTop('Welcome back', 'Sign in to your Snapbill account.'),
    h('div', { class: 'auth-form' },
      fieldRow('Email', textInput({ type: 'email', placeholder: 'you@business.com', oninput: e => (form.email = e.target.value), onkeydown: e => e.key === 'Enter' && submit() })),
      fieldRow('Password', textInput({ type: 'password', placeholder: 'Your password', oninput: e => (form.password = e.target.value), onkeydown: e => e.key === 'Enter' && submit() })),
      err,
      h('button', { class: 'btn btn-primary btn-lg btn-block', onclick: submit }, 'Sign in'),
      h('div', { class: 'auth-row-between' },
        h('a', { class: 'link', onclick: () => navigate('/recover') }, 'Forgot password?'),
        h('a', { class: 'link', onclick: () => navigate('/register') }, 'Create account'),
      ),
      h('div', { class: 'divider' }, h('span', {}, 'or')),
      h('button', { class: 'btn btn-ghost btn-block', onclick: async () => { form.email = DEMO_EMAIL; form.password = DEMO_PASSWORD; await submitDemo(err); } }, icon('sparkles', 16), 'Use demo account'),
    ),
  );
}
async function submitDemo(err) {
  try { const acc = await ensureDemoAccount(); setSession(acc.id); state.set({ account: acc, business: await getBusiness(acc.id) }); navigate('/'); toast('Demo loaded', 'success'); }
  catch (e) { err.textContent = e.message; }
}

export function recoverScreen() {
  const form = { email: '', answer: '', password: '' };
  const err = h('div', { class: 'form-error' });
  const info = h('div', { class: 'form-hint' });
  const submit = async () => {
    err.textContent = ''; info.textContent = '';
    if (!form.email) return (err.textContent = 'Enter your account email.');
    if (form.password.length < 6) return (err.textContent = 'New password must be at least 6 characters.');
    try {
      await resetPassword(form.email, form.answer, form.password);
      toast('Password updated — please sign in', 'success');
      navigate('/login');
    } catch (e) { err.textContent = e.message; }
  };
  return h('div', { class: 'auth-screen scroll' },
    authTop('Reset password', 'Answer your security question to set a new password.'),
    h('div', { class: 'auth-form' },
      fieldRow('Account email', textInput({ type: 'email', placeholder: 'you@business.com', oninput: e => (form.email = e.target.value) })),
      fieldRow('Security question', textInput({ value: 'What city were you born in?', disabled: true })),
      fieldRow('Your answer', textInput({ placeholder: 'Answer', oninput: e => (form.answer = e.target.value) })),
      fieldRow('New password', textInput({ type: 'password', placeholder: 'At least 6 characters', oninput: e => (form.password = e.target.value) })),
      err, info,
      h('button', { class: 'btn btn-primary btn-lg btn-block', onclick: submit }, 'Update password'),
      h('p', { class: 'auth-alt' }, h('a', { onclick: () => navigate('/login') }, 'Back to sign in')),
    ),
  );
}

function authTop(title, sub) {
  return h('div', { class: 'auth-top' },
    h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => history.back() }, icon('arrowLeft', 22)),
    h('div', {}, h('h1', { class: 'auth-h1' }, title), h('p', { class: 'auth-sub muted' }, sub)),
  );
}

// ---------- Business setup (multi-step onboarding) ----------
const BIZ_TYPES = ['Freelancer', 'Design & Web Services', 'Consulting', 'Trades & Construction', 'Photography', 'Cleaning Services', 'Landscaping', 'Coaching', 'Retail', 'Other'];

export async function setupScreen() {
  const existing = (await getBusiness(state.account.id)) || {};
  const b = {
    accountId: state.account.id, ownerName: existing.ownerName || state.account.ownerName,
    businessName: existing.businessName || '', type: existing.type || BIZ_TYPES[0],
    logoDataUrl: existing.logoDataUrl || '', email: existing.email || state.account.email,
    phone: existing.phone || '', address: existing.address || '',
    currency: existing.currency || 'USD', taxLabel: existing.taxLabel || 'Sales Tax',
    taxRate: existing.taxRate != null ? existing.taxRate : 0, taxInclusive: !!existing.taxInclusive,
    numberingPrefix: existing.numberingPrefix || 'INV-', nextNumber: existing.nextNumber || 1001,
    paymentInstructions: existing.paymentInstructions || '', paymentTerms: existing.paymentTerms || 14,
    defaultNotes: existing.defaultNotes || 'Thank you for your business!',
    defaultTerms: existing.defaultTerms || 'Payment due within 14 days of invoice date.',
    accent: existing.accent || '#4F46E5', id: existing.id,
  };
  let step = 0;
  const totalSteps = 4;
  const host = h('div', { class: 'auth-screen scroll' });

  function render() {
    host.innerHTML = '';
    host.appendChild(h('div', { class: 'setup-head' },
      h('div', { class: 'setup-progress' }, ...Array.from({ length: totalSteps }, (_, i) => h('span', { class: 'dot' + (i <= step ? ' on' : '') }))),
      h('h1', { class: 'auth-h1' }, ['About your business', 'Contact details', 'Currency & tax', 'Invoice defaults'][step]),
      h('p', { class: 'muted' }, `Step ${step + 1} of ${totalSteps}`),
    ));
    const body = h('div', { class: 'auth-form' });
    if (step === 0) {
      body.append(
        logoUploader(b),
        fieldRow('Business name', textInput({ value: b.businessName, placeholder: 'e.g. Blake Home Services', oninput: e => (b.businessName = e.target.value) })),
        fieldRow('Owner name', textInput({ value: b.ownerName, oninput: e => (b.ownerName = e.target.value) })),
        fieldRow('Type of business', selectInput(BIZ_TYPES.map(t => ({ value: t, label: t })), { value: b.type, onchange: e => (b.type = e.target.value) })),
      );
    } else if (step === 1) {
      body.append(
        fieldRow('Business email', textInput({ type: 'email', value: b.email, oninput: e => (b.email = e.target.value) })),
        fieldRow('Phone number', textInput({ value: b.phone, placeholder: '+1 (555) 000-0000', oninput: e => (b.phone = e.target.value) })),
        fieldRow('Business address', textArea({ value: b.address, placeholder: 'Street, City, Postcode', oninput: e => (b.address = e.target.value) })),
      );
    } else if (step === 2) {
      body.append(
        fieldRow('Default currency', selectInput(Object.entries(CURRENCIES).map(([code, c]) => ({ value: code, label: `${code} — ${c.name}` })), { value: b.currency, onchange: e => (b.currency = e.target.value) })),
        fieldRow('Tax label', textInput({ value: b.taxLabel, placeholder: 'Sales Tax / VAT / GST', oninput: e => (b.taxLabel = e.target.value) })),
        fieldRow('Default tax rate (%)', textInput({ type: 'number', step: '0.01', value: b.taxRate, oninput: e => (b.taxRate = parseFloat(e.target.value) || 0) })),
        h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: b.taxInclusive, onchange: e => (b.taxInclusive = e.target.checked) }), h('span', {}, 'Prices already include tax')),
      );
    } else {
      body.append(
        h('div', { class: 'grid-2' },
          fieldRow('Invoice prefix', textInput({ value: b.numberingPrefix, placeholder: 'INV-', oninput: e => (b.numberingPrefix = e.target.value) })),
          fieldRow('Next number', textInput({ type: 'number', value: b.nextNumber, oninput: e => (b.nextNumber = parseInt(e.target.value) || 1001) })),
        ),
        fieldRow('Standard payment terms (days)', textInput({ type: 'number', value: b.paymentTerms, oninput: e => (b.paymentTerms = parseInt(e.target.value) || 14) })),
        fieldRow('Payment instructions', textArea({ value: b.paymentInstructions, placeholder: 'Bank transfer details, accepted methods…', oninput: e => (b.paymentInstructions = e.target.value) })),
        fieldRow('Invoice accent colour', colorPicker(b)),
      );
    }
    host.appendChild(body);
    host.appendChild(h('div', { class: 'setup-nav' },
      step > 0 ? h('button', { class: 'btn btn-ghost', onclick: () => { step--; render(); } }, 'Back') : h('span'),
      step < totalSteps - 1
        ? h('button', { class: 'btn btn-primary', onclick: () => { if (step === 0 && !b.businessName.trim()) return toast('Please enter a business name', 'warn'); step++; render(); } }, 'Continue')
        : h('button', { class: 'btn btn-primary', onclick: finish }, 'Finish setup'),
    ));
  }
  async function finish() {
    if (!b.businessName.trim()) { step = 0; render(); return toast('Business name is required', 'warn'); }
    await saveBusiness(b);
    state.set({ business: b });
    toast('Business profile saved', 'success');
    navigate('/');
  }
  render();
  return host;
}

export function logoUploader(b) {
  const preview = h('div', { class: 'logo-preview' });
  const paint = () => { preview.innerHTML = ''; preview.appendChild(b.logoDataUrl ? h('img', { src: b.logoDataUrl, alt: 'logo' }) : h('span', { class: 'logo-ph' }, (b.businessName || 'S').slice(0, 1).toUpperCase())); };
  paint();
  const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) return toast('Please use an image under 1.5 MB', 'warn');
    b.logoDataUrl = await resizeImage(file, 400);
    paint();
  } });
  return h('div', { class: 'logo-uploader' }, preview,
    h('div', {}, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => input.click() }, icon('building', 16), 'Upload logo'),
      b.logoDataUrl ? h('button', { class: 'btn btn-text btn-sm', onclick: () => { b.logoDataUrl = ''; paint(); } }, 'Remove') : null,
      input),
  );
}

export function colorPicker(b) {
  const colors = ['#4F46E5', '#0EA5E9', '#059669', '#DC2626', '#EA580C', '#7C3AED', '#DB2777', '#0F766E', '#1E293B'];
  const wrap = h('div', { class: 'color-row' });
  const paint = () => { wrap.innerHTML = ''; for (const c of colors) wrap.appendChild(h('button', { class: 'swatch' + (b.accent === c ? ' on' : ''), style: { background: c }, onclick: () => { b.accent = c; paint(); } })); };
  paint();
  return wrap;
}

export function resizeImage(file, max = 400) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
