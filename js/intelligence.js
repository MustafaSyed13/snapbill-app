// Snapbill intelligence — works fully offline using rules + statistics.
// If an optional AI endpoint is configured (Account Settings), writing/NL tasks
// can call it, but every feature has a reliable local fallback.
import { analytics, computeTotals, effectiveStatus, rangeFor, groupBy } from './model.js';
import { money, fmtDate, monthLabel, monthKey } from './format.js';

const NUM_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
function wordToNum(w) {
  if (w == null) return null;
  w = String(w).toLowerCase().trim();
  if (/^\d+(\.\d+)?$/.test(w)) return parseFloat(w);
  if (NUM_WORDS[w] != null) return NUM_WORDS[w];
  const parts = w.split(/[\s-]+/); let total = 0, ok = false;
  for (const p of parts) { if (NUM_WORDS[p] != null) { total += NUM_WORDS[p]; ok = true; } }
  return ok ? total : null;
}

// ---------- Natural-language invoice parsing ----------
// e.g. "Create an invoice for Sarah's Bakery for two logo concepts at $300 each, due in fourteen days"
export function parseInvoiceText(text, ctx = {}) {
  const draft = { customerName: '', lineItems: [], dueInDays: null, notes: '' };
  if (!text) return draft;
  let t = ' ' + text.trim() + ' ';

  // Customer: "for <Name> for|to bill|:" — capture between "for" and the next "for"
  let cust = t.match(/\bfor\s+(.+?)\s+for\s+/i);
  if (!cust) cust = t.match(/\b(?:to|bill)\s+(.+?)(?:\s+for\b|,|:)/i);
  if (cust) draft.customerName = cleanName(cust[1]);

  // Due date: "due in N days/weeks" or "due <weekday>" or "net N"
  const dueDays = t.match(/due\s+in\s+([a-z0-9-]+)\s+(day|days|week|weeks)/i);
  if (dueDays) {
    const n = wordToNum(dueDays[1]) || 0;
    draft.dueInDays = /week/i.test(dueDays[2]) ? n * 7 : n;
  } else {
    const net = t.match(/net\s+(\d+)/i);
    if (net) draft.dueInDays = parseInt(net[1], 10);
    else if (/due\s+today/i.test(t)) draft.dueInDays = 0;
    else if (/due\s+tomorrow/i.test(t)) draft.dueInDays = 1;
    else if (/end of month|eom/i.test(t)) { const d = new Date(); draft.dueInDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate(); }
  }

  // Line items: split the "for ... " remainder on "and" / commas, then parse each
  let itemsBlock = t;
  const forIdx = draft.customerName ? t.toLowerCase().indexOf(' for ', t.toLowerCase().indexOf(draft.customerName.toLowerCase())) : t.toLowerCase().lastIndexOf(' for ');
  if (forIdx >= 0) itemsBlock = t.slice(forIdx + 5);
  itemsBlock = itemsBlock.replace(/,?\s*due\s+.*$/i, '').replace(/[.,]\s*$/, '');
  const chunks = itemsBlock.split(/\s+and\s+|,\s*/i).map(s => s.trim()).filter(Boolean);

  for (const chunk of chunks) {
    const item = parseLineChunk(chunk, ctx);
    if (item) draft.lineItems.push(item);
  }
  // Fallback single item if nothing parsed but there's text
  if (!draft.lineItems.length && itemsBlock.trim()) {
    const priceM = itemsBlock.match(/\$?\s*(\d+(?:\.\d+)?)/);
    draft.lineItems.push({ name: cleanName(itemsBlock.replace(/\$?\s*\d+(?:\.\d+)?/, '').replace(/\b(each|at|for|of)\b/gi, '')) || 'Service', qty: 1, price: priceM ? parseFloat(priceM[1]) : 0, taxable: true });
  }
  return draft;
}

function parseLineChunk(chunk, ctx) {
  if (!chunk) return null;
  let qty = 1, price = 0, name = chunk;
  // qty at start: "two logo concepts", "3x", "5 pages"
  const qm = chunk.match(/^\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty)\s*(?:x\s*)?/i);
  if (qm && wordToNum(qm[1]) != null) { qty = wordToNum(qm[1]); name = chunk.slice(qm[0].length); }
  // price: "at $300 each", "$300", "for 300", "300 dollars"
  const pm = chunk.match(/(?:at|for|@|=)?\s*\$\s*(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*(?:dollars|usd|each|\/)/i);
  if (pm) { price = parseFloat(pm[1] || pm[2]); }
  else { const bare = chunk.match(/\$\s*(\d+(?:\.\d+)?)/); if (bare) price = parseFloat(bare[1]); }
  name = cleanName(name.replace(/(?:at|for|@|=)?\s*\$?\s*\d+(?:\.\d+)?\s*(?:dollars|usd|each|\/\s*\w+)?/gi, '').replace(/\beach\b/gi, ''));
  if (!name) return null;
  // Match against saved catalog for price if none given
  if (!price && ctx.items) {
    const found = ctx.items.find(i => i.name.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(i.name.toLowerCase()));
    if (found) { price = Number(found.price) || 0; name = found.name; }
  }
  return { name: titleCase(name), qty, price, taxable: true };
}
function cleanName(s) { return String(s || '').replace(/^[\s'"-]+|[\s'"-]+$/g, '').replace(/\s{2,}/g, ' ').trim(); }
function titleCase(s) { return cleanName(s).replace(/\b\w/g, c => c.toUpperCase()); }

// ---------- Business assistant (Q&A over the user's own data) ----------
export function askBusiness(question, data) {
  const { invoices, payments, customers } = data;
  const q = question.toLowerCase();
  const A = (range) => analytics(invoices, payments, range);

  const thisMonth = A(rangeFor('month'));
  const allTime = A(rangeFor('all'));

  // Comparison: this month vs last month
  if (/(compare|vs|versus|last month)/.test(q) && /month/.test(q)) {
    const now = new Date();
    const lastFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();
    const last = A({ from: lastFrom, to: lastTo });
    const diff = thisMonth.totalSales - last.totalSales;
    const pct = last.totalSales ? Math.round((diff / last.totalSales) * 100) : null;
    return {
      answer: `This month you've billed ${money(thisMonth.totalSales)} across ${thisMonth.count} invoice(s). Last month was ${money(last.totalSales)}. ` +
        (diff >= 0 ? `That's up ${money(Math.abs(diff))}${pct != null ? ` (${pct}%)` : ''}.` : `That's down ${money(Math.abs(diff))}${pct != null ? ` (${Math.abs(pct)}%)` : ''}.`),
      value: thisMonth.totalSales,
    };
  }
  if (/(unpaid|owed|outstanding|owe me|still.*(due|owed))/.test(q)) {
    return { answer: `You're owed ${money(allTime.outstanding)} in total, of which ${money(allTime.overdue)} is overdue across ${allTime.overdueCount} invoice(s).` };
  }
  if (/overdue/.test(q)) {
    const list = allTime.enriched.filter(e => e.status === 'overdue').sort((a, b) => a.inv.dueDate - b.inv.dueDate);
    if (!list.length) return { answer: 'Good news — you have no overdue invoices right now.' };
    const top = list.slice(0, 5).map(e => `• ${e.inv.number} — ${e.inv.customerSnapshot?.name || 'Customer'} — ${money(e.totals.balance)} (due ${fmtDate(e.inv.dueDate)})`).join('\n');
    return { answer: `You have ${list.length} overdue invoice(s) totalling ${money(allTime.overdue)}:\n${top}` };
  }
  if (/(top|best).*(customer|client)/.test(q) || /who.*(top|best)/.test(q)) {
    const top = allTime.topCustomers.slice(0, 5);
    if (!top.length) return { answer: 'No customer activity yet.' };
    return { answer: 'Your top customers by amount billed:\n' + top.map((c, i) => `${i + 1}. ${c.name} — ${money(c.billed)} (${c.count} invoice(s))`).join('\n') };
  }
  if (/(best|top).*(package)/.test(q) || /package.*(most|revenue|sold)/.test(q)) {
    const top = allTime.topPackages.slice(0, 5);
    if (!top.length) return { answer: 'No package sales recorded yet. Add a package to an invoice to start tracking.' };
    return { answer: 'Packages by revenue:\n' + top.map((p, i) => `${i + 1}. ${p.name} — ${money(p.revenue)} (${p.count} sold)`).join('\n') };
  }
  if (/how many.*(package|sold|sell)/.test(q)) {
    const term = (q.match(/how many\s+(.+?)\s+(?:package|did|have|sold)/) || [])[1];
    const target = term ? term.trim() : null;
    let count = 0;
    for (const inv of invoices) for (const li of (inv.lineItems || [])) {
      if (!target || (li.name || '').toLowerCase().includes(target)) count += Number(li.qty || 0);
    }
    return { answer: target ? `You've sold about ${count} unit(s) matching "${target}".` : `Total units sold across all invoices: ${count}.` };
  }
  if (/(best|which).*(product|service|selling|item)/.test(q)) {
    const top = allTime.topItems.slice(0, 5);
    if (!top.length) return { answer: 'No items sold yet.' };
    return { answer: 'Best sellers by revenue:\n' + top.map((p, i) => `${i + 1}. ${p.name} — ${money(p.revenue)} (${p.qty} sold)`).join('\n') };
  }
  if (/best.*(month|period)/.test(q)) {
    const map = {};
    for (const e of allTime.billable) { const k = monthKey(e.inv.issueDate || e.inv.createdAt); map[k] = (map[k] || 0) + e.totals.total; }
    const best = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    if (!best) return { answer: 'Not enough data yet to find your best month.' };
    return { answer: `Your best month so far was ${monthLabel(new Date(best[0] + '-15').getTime())} with ${money(best[1])} billed.` };
  }
  if (/(collect|received|paid to me|money in|income)/.test(q) && /month/.test(q)) {
    return { answer: `You've collected ${money(thisMonth.collected)} this month.` };
  }
  if (/(sell|sales|revenue|bill|made|earn)/.test(q)) {
    if (/this month|month/.test(q)) return { answer: `You've billed ${money(thisMonth.totalSales)} this month across ${thisMonth.count} invoice(s), collecting ${money(thisMonth.collected)}.`, value: thisMonth.totalSales };
    if (/year/.test(q)) { const y = A(rangeFor('year')); return { answer: `This year you've billed ${money(y.totalSales)} and collected ${money(y.collected)}.` }; }
    return { answer: `All-time you've billed ${money(allTime.totalSales)}, collected ${money(allTime.collected)}, with ${money(allTime.outstanding)} still outstanding.` };
  }
  if (/how many.*(customer|client)/.test(q)) return { answer: `You have ${customers.length} saved customer(s).` };
  if (/how many.*(invoice)/.test(q)) return { answer: `You have ${invoices.length} invoice(s) in total.` };
  if (/average|avg/.test(q)) return { answer: `Your average invoice value is ${money(allTime.avgInvoice)}.` };

  // Default overview
  return {
    answer: `Here's a quick snapshot:\n• Billed (all time): ${money(allTime.totalSales)}\n• Collected: ${money(allTime.collected)}\n• Outstanding: ${money(allTime.outstanding)} (${money(allTime.overdue)} overdue)\n• Avg invoice: ${money(allTime.avgInvoice)}\nTry asking: "How much is unpaid?", "Who are my top customers?", or "Compare this month to last month."`,
  };
}

export const ASSISTANT_SUGGESTIONS = [
  'How much did I sell this month?', 'How much money is still unpaid?', 'Which invoices are overdue?',
  'Who are my top customers?', 'What was my best sales month?', 'Compare this month with last month',
  'Which package made the most revenue?', 'What is my average invoice value?',
];

// ---------- Insights & smart recommendations ----------
export function generateInsights(data) {
  const { invoices, payments, customers } = data;
  const out = [];
  const all = analytics(invoices, payments, rangeFor('all'));

  // Overdue reminders
  const overdue = all.enriched.filter(e => e.status === 'overdue');
  if (overdue.length) {
    out.push({ kind: 'warn', icon: 'clock', title: `${overdue.length} overdue invoice(s)`, text: `${money(all.overdue)} is past due. Consider sending a friendly reminder.`, action: { label: 'View overdue', path: '/invoices?status=overdue' } });
  }
  // Revenue trend
  const s = all.monthlySeries;
  if (s.length >= 2) {
    const cur = s[s.length - 1].value, prev = s[s.length - 2].value;
    if (prev > 0) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      if (Math.abs(pct) >= 10) out.push({ kind: cur >= prev ? 'good' : 'warn', icon: 'trend', title: `Revenue ${cur >= prev ? 'up' : 'down'} ${Math.abs(pct)}%`, text: `${monthLabel(new Date(s[s.length - 1].key + '-15').getTime())} is ${money(cur)} vs ${money(prev)} the month before.` });
    }
  }
  // Late-paying customers (avg days to pay)
  const late = findLatePayers(invoices, payments);
  for (const l of late.slice(0, 2)) out.push({ kind: 'info', icon: 'user', title: `${l.name} tends to pay late`, text: `Averages ~${l.avgDays} days to settle. Consider shorter terms or a deposit.` });

  // Package suggestion from co-occurring items
  const combo = suggestPackage(invoices);
  if (combo) out.push({ kind: 'idea', icon: 'box', title: 'Save time with a package', text: `You often bill "${combo.join('" + "')}" together. Turn them into a reusable package.`, action: { label: 'Create package', path: '/packages/new' } });

  // Customers with outstanding balances
  const owing = all.topCustomers.filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 2);
  for (const c of owing) out.push({ kind: 'info', icon: 'wallet', title: `${c.name} owes ${money(c.balance)}`, text: 'Outstanding across their open invoices.' });

  // Best seller callout
  if (all.topItems[0]) out.push({ kind: 'good', icon: 'star', title: `Best seller: ${all.topItems[0].name}`, text: `${money(all.topItems[0].revenue)} in revenue so far.` });

  if (!out.length) out.push({ kind: 'idea', icon: 'sparkles', title: 'Getting started', text: 'Create a few invoices and record payments — Snapbill will surface trends and reminders here automatically.' });
  return out;
}

function findLatePayers(invoices, payments) {
  const paysByInv = groupBy(payments, p => p.invoiceId);
  const byCust = {};
  for (const inv of invoices) {
    const pays = paysByInv[inv.id] || [];
    if (!pays.length || !inv.dueDate) continue;
    const lastPay = Math.max(...pays.map(p => p.date || p.createdAt));
    const daysLate = Math.round((lastPay - inv.dueDate) / 86400000);
    const name = inv.customerSnapshot?.name || 'Customer';
    (byCust[name] = byCust[name] || []).push(daysLate);
  }
  return Object.entries(byCust)
    .map(([name, arr]) => ({ name, avgDays: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }))
    .filter(x => x.avgDays > 3)
    .sort((a, b) => b.avgDays - a.avgDays);
}

function suggestPackage(invoices) {
  const pairs = {};
  for (const inv of invoices) {
    const names = [...new Set((inv.lineItems || []).filter(li => !li.packageRef).map(li => (li.name || '').trim()).filter(Boolean))];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const key = [names[i], names[j]].sort().join(' ||| ');
      pairs[key] = (pairs[key] || 0) + 1;
    }
  }
  const best = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) return best[0].split(' ||| ');
  return null;
}

// ---------- Writing assistance (templates filled with real data) ----------
export function writeText(kind, ctx = {}) {
  const biz = ctx.business || {};
  const bname = biz.businessName || 'our business';
  const owner = biz.ownerName || (ctx.account && ctx.account.ownerName) || '';
  switch (kind) {
    case 'reminder': return `Hi ${ctx.customerName || 'there'},\n\nJust a friendly reminder that invoice ${ctx.number || ''} for ${money(ctx.balance || 0)} is due on ${fmtDate(ctx.dueDate)}. If you've already sent payment, thank you and please disregard this note.\n\nYou can reach me any time with questions.\n\nBest,\n${owner}\n${bname}`;
    case 'overdue': return `Hi ${ctx.customerName || 'there'},\n\nOur records show invoice ${ctx.number || ''} for ${money(ctx.balance || 0)} was due on ${fmtDate(ctx.dueDate)} and is now past due. Could you let me know when I can expect payment? ${biz.paymentInstructions ? '\n\nPayment details:\n' + biz.paymentInstructions : ''}\n\nHappy to help if anything is unclear.\n\nThank you,\n${owner}\n${bname}`;
    case 'productDesc': return `${ctx.name || 'This service'} — professional ${(ctx.category || 'service').toLowerCase()} delivered with care and attention to detail. Includes everything you need to get results, with clear communication throughout.`;
    case 'serviceDesc': return `${ctx.name || 'This service'}: a done-for-you ${(ctx.category || 'service').toLowerCase()} tailored to your needs. Reliable turnaround, transparent pricing, and quality you can count on.`;
    case 'notes': return `Thank you for your business! Payment is appreciated by the due date. Please don't hesitate to reach out with any questions about this invoice.`;
    case 'terms': return `Payment due within ${ctx.days || 14} days of the invoice date. Late payments may incur a fee. All work remains the property of ${bname} until paid in full.`;
    case 'weekly': {
      const a = analytics(ctx.invoices || [], ctx.payments || [], rangeFor('week'));
      return `Weekly summary for ${bname}:\n• Billed: ${money(a.totalSales)} across ${a.count} invoice(s)\n• Collected: ${money(a.collected)}\n• Outstanding: ${money(a.outstanding)} (${money(a.overdue)} overdue)\n• Top customer: ${a.topCustomers[0]?.name || '—'}\nKeep up the great work!`;
    }
    case 'monthly': {
      const a = analytics(ctx.invoices || [], ctx.payments || [], rangeFor('month'));
      return `Monthly summary for ${bname}:\n• Billed: ${money(a.totalSales)} across ${a.count} invoice(s)\n• Collected: ${money(a.collected)}\n• Outstanding: ${money(a.outstanding)}\n• Average invoice: ${money(a.avgInvoice)}\n• Best seller: ${a.topItems[0]?.name || '—'}\n• Top customer: ${a.topCustomers[0]?.name || '—'}`;
    }
    default: return '';
  }
}

// ---------- Optional AI hook (graceful) ----------
export function aiConfig() {
  try { return JSON.parse(localStorage.getItem('snapbill.ai') || 'null'); } catch { return null; }
}
export function setAiConfig(cfg) { localStorage.setItem('snapbill.ai', JSON.stringify(cfg || {})); }
export function aiAvailable() { const c = aiConfig(); return !!(c && c.endpoint && c.apiKey); }

// Attempts an OpenAI-compatible chat completion; falls back to null on any error.
export async function aiComplete(prompt, system) {
  const c = aiConfig();
  if (!c || !c.endpoint || !c.apiKey) return null;
  try {
    const res = await fetch(c.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey },
      body: JSON.stringify({ model: c.model || 'gpt-4o-mini', messages: [system ? { role: 'system', content: system } : null, { role: 'user', content: prompt }].filter(Boolean), temperature: 0.4 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}
