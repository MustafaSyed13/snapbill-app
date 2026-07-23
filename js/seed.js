// Seeds a realistic demo account so the dashboard and analytics are populated on first run.
import { createAccount, authenticate, saveBusiness, Customers, Items, Packages, Invoices, Payments, uid } from './db.js';

export const DEMO_EMAIL = 'demo@snapbill.app';
export const DEMO_PASSWORD = 'demo1234';

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d.getTime(); }
function daysFromNow(n) { return daysAgo(-n); }

export async function ensureDemoAccount() {
  let acc;
  try {
    acc = await authenticate(DEMO_EMAIL, DEMO_PASSWORD);
  } catch {
    acc = await createAccount({ ownerName: 'Alex Rivera', email: DEMO_EMAIL, password: DEMO_PASSWORD });
  }
  const aid = acc.id;

  // Already seeded on a previous run (or by another visitor) — reuse it as-is.
  const existingCustomers = await Customers.list(aid);
  if (existingCustomers.length > 0) return acc;

  await saveBusiness({
    accountId: aid, businessName: 'Rivera Studio', type: 'Design & Web Services',
    ownerName: 'Alex Rivera', email: 'hello@riverastudio.com', phone: '+1 (555) 240-1180',
    address: '221 Maple Ave, Suite 4\nPortland, OR 97205', currency: 'USD',
    taxLabel: 'Sales Tax', taxRate: 8, taxInclusive: false,
    numberingPrefix: 'INV-', nextNumber: 1021, paymentTerms: 14,
    paymentInstructions: 'Bank transfer: Rivera Studio LLC\nRouting 021000021 · Account 123456789\nOr pay by card/cheque. Thank you!',
    defaultNotes: 'Thank you for your business! Please reach out with any questions.',
    defaultTerms: 'Payment due within 14 days of invoice date.', accent: '#4F46E5',
  });

  const customers = [
    { name: "Sarah's Bakery", company: "Sarah's Bakery LLC", email: 'sarah@sarahsbakery.com', phone: '+1 (555) 118-2299', address: '18 Baker St\nPortland, OR 97210', notes: 'Prefers email. Pays promptly.' },
    { name: 'Nomad Coffee Co.', company: 'Nomad Coffee Co.', email: 'ops@nomadcoffee.co', phone: '+1 (555) 771-0043', address: '900 Bean Blvd\nSeattle, WA 98101', notes: 'Growing chain, 3 locations.' },
    { name: 'GreenLeaf Landscaping', company: 'GreenLeaf Landscaping', email: 'billing@greenleaf.com', phone: '+1 (555) 662-8890', address: '55 Garden Way\nPortland, OR 97213', notes: 'Sometimes pays late.' },
    { name: 'Bright Dental', company: 'Bright Dental Group', email: 'admin@brightdental.com', phone: '+1 (555) 330-1122', address: '410 Smile Dr\nVancouver, WA 98660', notes: '' },
    { name: 'Harbor Law', company: 'Harbor Law Partners', email: 'accounts@harborlaw.com', phone: '+1 (555) 989-4410', address: '77 Marina Pkwy\nPortland, OR 97201', notes: 'Net-30 preferred.' },
  ];
  const custRecs = [];
  for (const c of customers) custRecs.push(await Customers.save({ ...c }, aid));

  const items = [
    { name: 'Logo Concept', category: 'Design', description: 'Custom logo concept with 2 revisions', price: 300, taxable: true, unit: 'each', type: 'service' },
    { name: 'Landing Page', category: 'Web', description: 'Responsive single-page website', price: 850, taxable: true, unit: 'each', type: 'service' },
    { name: 'Brand Guidelines', category: 'Design', description: 'Colours, type, and logo usage doc', price: 600, taxable: true, unit: 'each', type: 'service' },
    { name: 'Hourly Consulting', category: 'Consulting', description: 'Design & strategy consulting', price: 120, taxable: true, unit: 'hour', type: 'service' },
    { name: 'Social Media Kit', category: 'Design', description: '12 templated social posts', price: 450, taxable: true, unit: 'each', type: 'service' },
    { name: 'Business Cards (500)', category: 'Print', description: 'Print-ready + 500 printed cards', price: 180, taxable: true, unit: 'pack', type: 'product' },
    { name: 'Monthly Support', category: 'Web', description: 'Site maintenance & updates', price: 200, taxable: false, unit: 'month', type: 'service' },
  ];
  const itemRecs = [];
  for (const it of items) itemRecs.push(await Items.save({ ...it }, aid));

  const packages = [
    { name: 'Premium Website Package', description: 'Everything a small business needs to launch online.', price: 2200,
      items: [
        { name: 'Website design', description: 'Custom responsive design', qty: 1, price: 850, taxable: true },
        { name: 'Five custom pages', description: 'Home, About, Services, Portfolio, Contact', qty: 5, price: 120, taxable: true },
        { name: 'Mobile optimization', description: 'Tuned for phones & tablets', qty: 1, price: 250, taxable: true },
        { name: 'Contact form', description: 'Email-integrated form', qty: 1, price: 150, taxable: true },
        { name: '30 days of support', description: 'Post-launch fixes & help', qty: 1, price: 300, taxable: false },
      ] },
    { name: 'Brand Starter Package', description: 'Logo + guidelines + social kit.', price: 1200,
      items: [
        { name: 'Logo Concept', description: 'With 2 revisions', qty: 1, price: 300, taxable: true },
        { name: 'Brand Guidelines', description: 'Colours & type', qty: 1, price: 600, taxable: true },
        { name: 'Social Media Kit', description: '12 templates', qty: 1, price: 450, taxable: true },
      ] },
  ];
  const pkgRecs = [];
  for (const p of packages) pkgRecs.push(await Packages.save({ ...p }, aid));

  // Invoices spread across recent months with varied statuses
  const C = name => custRecs.find(c => c.name === name);
  function snap(c) { return { id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, address: c.address }; }
  let n = 1001;
  const mk = (cust, issue, dueDays, lines, opts = {}) => ({
    accountId: aid, number: 'INV-' + (n++), customerId: cust.id, customerSnapshot: snap(cust),
    issueDate: issue, dueDate: daysFromNow(0) + 0 || issue, // placeholder set below
    _dueDays: dueDays, lineItems: lines.map(l => ({ id: uid('li_'), taxable: true, ...l })),
    taxRate: opts.taxRate != null ? opts.taxRate : 8, taxInclusive: false,
    discountType: opts.discountType || 'none', discountValue: opts.discountValue || 0,
    depositRequested: opts.deposit || 0, currency: 'USD',
    notes: 'Thank you for your business!', terms: 'Payment due within 14 days of invoice date.',
    status: opts.status || 'sent', createdAt: issue,
  });

  const defs = [
    // customer, issueDaysAgo, dueDays, lines, {status, payments:[amounts/day], ...}
    [C("Sarah's Bakery"), 96, 14, [{ name: 'Logo Concept', qty: 2, price: 300 }], { status: 'paid', pay: [{ amt: 648, day: 88 }] }],
    [C('Nomad Coffee Co.'), 80, 14, [{ name: 'Premium Website Package', qty: 1, price: 2200, packageRef: pkgRecs[0].id, packageName: 'Premium Website Package' }], { status: 'paid', taxRate: 8, pay: [{ amt: 2376, day: 70 }] }],
    [C('GreenLeaf Landscaping'), 70, 14, [{ name: 'Landing Page', qty: 1, price: 850 }, { name: 'Business Cards (500)', qty: 1, price: 180 }], { status: 'paid', pay: [{ amt: 1112.4, day: 40 }] }],
    [C('Bright Dental'), 60, 30, [{ name: 'Brand Starter Package', qty: 1, price: 1200, packageRef: pkgRecs[1].id, packageName: 'Brand Starter Package' }], { status: 'paid', pay: [{ amt: 1296, day: 35 }] }],
    [C('Harbor Law'), 50, 30, [{ name: 'Hourly Consulting', qty: 10, price: 120 }], { status: 'paid', pay: [{ amt: 1296, day: 22 }] }],
    [C('Nomad Coffee Co.'), 38, 14, [{ name: 'Social Media Kit', qty: 2, price: 450 }], { status: 'paid', pay: [{ amt: 972, day: 30 }] }],
    [C("Sarah's Bakery"), 28, 14, [{ name: 'Monthly Support', qty: 1, price: 200, taxable: false }, { name: 'Landing Page', qty: 1, price: 850 }], { status: 'partial', pay: [{ amt: 500, day: 20 }] }],
    [C('GreenLeaf Landscaping'), 25, 14, [{ name: 'Brand Guidelines', qty: 1, price: 600 }], { status: 'overdue' }],
    [C('Bright Dental'), 18, 14, [{ name: 'Premium Website Package', qty: 1, price: 2200, packageRef: pkgRecs[0].id, packageName: 'Premium Website Package' }], { status: 'overdue' }],
    [C('Harbor Law'), 8, 21, [{ name: 'Hourly Consulting', qty: 6, price: 120 }], { status: 'sent' }],
    [C('Nomad Coffee Co.'), 4, 14, [{ name: 'Social Media Kit', qty: 1, price: 450 }, { name: 'Business Cards (500)', qty: 2, price: 180 }], { status: 'viewed' }],
    [C("Sarah's Bakery"), 2, 14, [{ name: 'Logo Concept', qty: 1, price: 300 }], { status: 'draft' }],
  ];

  for (const [cust, issueAgo, dueDays, lines, opts] of defs) {
    const issue = daysAgo(issueAgo);
    const inv = mk(cust, issue, dueDays, lines, opts);
    inv.dueDate = daysAgo(issueAgo - dueDays);
    if (opts.status === 'draft') inv.status = 'draft';
    else if (opts.status === 'sent') inv.status = 'sent';
    else if (opts.status === 'viewed') inv.status = 'viewed';
    else inv.status = 'sent';
    const saved = await Invoices.save(inv, aid);
    if (opts.pay) {
      for (const p of opts.pay) {
        await Payments.save({ accountId: aid, invoiceId: saved.id, amount: p.amt, method: p.method || 'Bank Transfer', date: daysAgo(p.day), note: '' }, aid);
      }
    }
  }

  return acc;
}
