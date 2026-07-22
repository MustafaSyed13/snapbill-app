// Analytics, business assistant, and notifications screens.
import { h, icon, navigate, state, toast } from './lib.js';
import { pageHeader, loadAccountData, statTile, barChart, statusPill } from './screens-common.js';
import { analytics, rangeFor, computeTotals, effectiveStatus } from './model.js';
import { money, fmtDate, fmtDateInput, parseDateInput, relativeDays } from './format.js';
import { askBusiness, ASSISTANT_SUGGESTIONS, generateInsights, aiAvailable, aiComplete } from './intelligence.js';
import { sectionTitle } from './screens-dashboard.js';

const RANGES = [['week', '7 days'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['all', 'All'], ['custom', 'Custom']];

export async function analyticsScreen() {
  const data = await loadAccountData();
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });
  let rangeKind = 'month';
  let custom = { from: parseDateInput(fmtDateInput(Date.now())) - 30 * 86400000, to: parseDateInput(fmtDateInput(Date.now())) };

  function render() {
    host.innerHTML = '';
    host.appendChild(pageHeader('Sales analytics'));
    const range = rangeFor(rangeKind, custom);
    const seg = h('div', { class: 'seg wrap' });
    for (const [k, l] of RANGES) seg.appendChild(h('button', { class: 'seg-btn' + (k === rangeKind ? ' on' : ''), onclick: () => { rangeKind = k; render(); } }, l));
    host.appendChild(seg);
    if (rangeKind === 'custom') {
      host.appendChild(h('div', { class: 'card grid-2' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'From'), h('input', { class: 'input', type: 'date', value: fmtDateInput(custom.from), onchange: e => { custom.from = parseDateInput(e.target.value); render(); } })),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'To'), h('input', { class: 'input', type: 'date', value: fmtDateInput(custom.to), onchange: e => { custom.to = parseDateInput(e.target.value) + 86399000; render(); } })),
      ));
    }
    const a = analytics(data.invoices, data.payments, range);

    host.appendChild(h('div', { class: 'stat-grid' },
      statTile({ label: 'Total billed', value: m(a.totalSales), tone: 'indigo', iconName: 'invoice' }),
      statTile({ label: 'Collected', value: m(a.collected), tone: 'emerald', iconName: 'wallet' }),
      statTile({ label: 'Outstanding', value: m(a.outstanding), tone: 'amber', iconName: 'clock' }),
      statTile({ label: 'Avg invoice', value: m(a.avgInvoice), tone: 'default', iconName: 'file' }),
    ));

    host.appendChild(sectionTitle('Revenue by month'));
    host.appendChild(h('div', { class: 'card' }, barChart(a.monthlySeries, { fmt: m })));

    host.appendChild(sectionTitle('Invoice status'));
    host.appendChild(h('div', { class: 'card' },
      statusBar('Paid', a.paidCount, 'emerald'),
      statusBar('Pending', a.pendingCount, 'amber'),
      statusBar('Overdue', a.overdueCount, 'red'),
      statusBar('Drafts', a.draftCount, 'slate'),
    ));

    rankCard(host, 'Top customers', a.topCustomers.slice(0, 5).map(c => [c.name, m(c.billed), `${c.count} inv`]));
    rankCard(host, 'Best-selling items', a.topItems.slice(0, 5).map(i => [i.name, m(i.revenue), `${i.qty} sold`]));
    rankCard(host, 'Best packages', a.topPackages.slice(0, 5).map(p => [p.name, m(p.revenue), `${p.count} sold`]));

    // Patterns
    host.appendChild(sectionTitle('Business patterns'));
    const insights = generateInsights(data);
    const insWrap = h('div', { class: 'insight-list' });
    for (const ins of insights) insWrap.appendChild(h('div', { class: `insight insight-${ins.kind}`, onclick: ins.action ? () => navigate(ins.action.path) : null },
      h('div', { class: 'insight-ico' }, icon(ins.icon, 18)), h('div', { class: 'insight-body' }, h('div', { class: 'insight-title' }, ins.title), h('div', { class: 'insight-text' }, ins.text)), ins.action ? icon('arrowRight', 16) : null));
    host.appendChild(insWrap);
    host.appendChild(h('div', { class: 'bottom-pad' }));
  }
  render();
  return host;
}

function statusBar(label, count, color) {
  return h('div', { class: 'status-bar-row' }, h('span', { class: 'muted' }, label), h('div', { class: 'status-bar-track' }, h('div', { class: `status-bar-fill fill-${color}`, style: { width: Math.min(100, count * 12 + (count ? 8 : 0)) + '%' } })), h('strong', {}, String(count)));
}
function rankCard(host, title, rows) {
  host.appendChild(sectionTitle(title));
  if (!rows.length) { host.appendChild(h('div', { class: 'card muted center pad-sm' }, 'No data in this range.')); return; }
  const card = h('div', { class: 'card list' });
  rows.forEach((r, i) => card.appendChild(h('div', { class: 'list-row' },
    h('div', { class: 'rank-num' }, String(i + 1)),
    h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, r[0]), h('div', { class: 'list-sub' }, r[2])),
    h('div', { class: 'list-amt' }, r[1]))));
  host.appendChild(card);
}

// ---------- Assistant ----------
export async function assistantScreen() {
  const data = await loadAccountData();
  const host = h('div', { class: 'screen assistant' });
  host.appendChild(pageHeader('Business assistant'));
  const thread = h('div', { class: 'chat-thread' });
  const aiTag = aiAvailable() ? ' (AI connected)' : '';
  thread.appendChild(botMsg(`Hi! I answer questions about your own business data${aiTag}. Ask me anything, or tap a suggestion below.`));
  host.appendChild(thread);

  const chips = h('div', { class: 'suggest-chips' });
  for (const s of ASSISTANT_SUGGESTIONS) chips.appendChild(h('button', { class: 'suggest-chip', onclick: () => ask(s) }, s));
  const chipWrap = h('div', { class: 'suggest-wrap' }, chips);
  host.appendChild(chipWrap);

  const input = h('input', { class: 'chat-input', placeholder: 'Ask about your business…', onkeydown: e => { if (e.key === 'Enter' && input.value.trim()) ask(input.value); } });
  host.appendChild(h('div', { class: 'chat-bar' }, input, h('button', { class: 'btn btn-primary chat-send', onclick: () => input.value.trim() && ask(input.value) }, icon('send', 18))));

  async function ask(q) {
    input.value = '';
    thread.appendChild(userMsg(q));
    chipWrap.style.display = 'none';
    const typing = botMsg('…'); typing.classList.add('typing'); thread.appendChild(typing);
    thread.scrollTop = thread.scrollHeight;
    // Local answer always available
    const local = askBusiness(q, data);
    let answer = local.answer;
    // If AI configured, optionally enrich phrasing using local facts as grounding (never invents numbers)
    if (aiAvailable()) {
      const enriched = await aiComplete(`Rephrase this business answer in a friendly, concise way. Do not change any numbers or facts.\n\n${answer}`, 'You are a helpful small-business assistant. Never invent figures.');
      if (enriched) answer = enriched;
    }
    typing.remove();
    thread.appendChild(botMsg(answer));
    thread.scrollTop = thread.scrollHeight;
  }
  setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 50);
  return host;
}
function botMsg(text) { return h('div', { class: 'msg bot' }, h('div', { class: 'msg-ico' }, icon('sparkles', 16)), h('div', { class: 'msg-bubble pre' }, text)); }
function userMsg(text) { return h('div', { class: 'msg user' }, h('div', { class: 'msg-bubble' }, text)); }

// ---------- Notifications ----------
export async function notificationsScreen() {
  const data = await loadAccountData();
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Notifications', { back: '/more' }));

  const notes = [];
  for (const inv of data.invoices) {
    const t = computeTotals(inv, data.payments.filter(p => p.invoiceId === inv.id));
    const st = effectiveStatus(inv, t);
    if (st === 'overdue') notes.push({ kind: 'red', icon: 'alert', title: `${inv.number} is overdue`, text: `${inv.customerSnapshot?.name || 'Customer'} owes ${m(t.balance)} — was due ${fmtDate(inv.dueDate)}.`, path: '/invoices/' + inv.id, ts: inv.dueDate });
    else if (['sent', 'viewed', 'pending', 'partially_paid'].includes(st) && inv.dueDate) {
      const days = Math.round((inv.dueDate - Date.now()) / 86400000);
      if (days >= 0 && days <= 3) notes.push({ kind: 'amber', icon: 'clock', title: `${inv.number} due ${relativeDays(inv.dueDate)}`, text: `${inv.customerSnapshot?.name || 'Customer'} · ${m(t.balance)} outstanding.`, path: '/invoices/' + inv.id, ts: inv.dueDate });
    }
  }
  // Insights as notifications
  for (const ins of generateInsights(data)) if (['warn', 'idea'].includes(ins.kind)) notes.push({ kind: ins.kind === 'warn' ? 'amber' : 'indigo', icon: ins.icon, title: ins.title, text: ins.text, path: ins.action?.path, ts: Date.now() });

  notes.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (!notes.length) { host.appendChild(h('div', { class: 'empty pad' }, h('div', { class: 'empty-ico' }, icon('bell', 28)), h('h3', {}, 'All caught up'), h('p', { class: 'muted' }, 'Reminders about overdue and upcoming invoices will appear here.'))); return host; }
  const list = h('div', { class: 'insight-list' });
  for (const n of notes) list.appendChild(h('div', { class: `insight insight-${n.kind === 'red' ? 'warn' : n.kind === 'amber' ? 'warn' : 'idea'}`, onclick: n.path ? () => navigate(n.path) : null },
    h('div', { class: 'insight-ico' }, icon(n.icon, 18)), h('div', { class: 'insight-body' }, h('div', { class: 'insight-title' }, n.title), h('div', { class: 'insight-text' }, n.text)), n.path ? icon('arrowRight', 16) : null));
  host.appendChild(list);
  host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;
}
