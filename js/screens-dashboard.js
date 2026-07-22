// Dashboard screen with range switcher, KPIs, chart, insights, and quick actions.
import { h, icon, navigate, state, frag } from './lib.js';
import { loadAccountData, statTile, barChart, donut, statusPill } from './screens-common.js';
import { analytics, rangeFor, computeTotals, effectiveStatus } from './model.js';
import { money, fmtDate, relativeDays } from './format.js';
import { generateInsights } from './intelligence.js';

const RANGES = [['week', '7 days'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['all', 'All']];

export async function dashboardScreen() {
  const data = await loadAccountData();
  const host = h('div', { class: 'screen scroll' });
  let rangeKind = sessionStorage.getItem('snapbill.range') || 'month';

  function render() {
    sessionStorage.setItem('snapbill.range', rangeKind);
    host.innerHTML = '';
    const range = rangeFor(rangeKind);
    const a = analytics(data.invoices, data.payments, range);
    const biz = data.business || {};
    const cur = biz.currency || 'USD';
    const m = v => money(v, cur);

    host.appendChild(h('div', { class: 'dash-top' },
      h('div', {},
        h('div', { class: 'greeting' }, `Hi ${(biz.ownerName || state.account.ownerName || 'there').split(' ')[0]} 👋`),
        h('div', { class: 'dash-biz' }, biz.businessName || 'Your business'),
      ),
      h('button', { class: 'avatar-btn', onclick: () => navigate('/more') }, (biz.businessName || 'S').slice(0, 1).toUpperCase()),
    ));

    // Range switcher
    const switcher = h('div', { class: 'seg' });
    for (const [k, label] of RANGES) switcher.appendChild(h('button', { class: 'seg-btn' + (k === rangeKind ? ' on' : ''), onclick: () => { rangeKind = k; render(); } }, label));
    host.appendChild(switcher);

    // Hero card: total sales + collected/outstanding
    host.appendChild(h('div', { class: 'hero-card' },
      h('div', { class: 'hero-card-row' },
        h('div', {}, h('div', { class: 'hero-card-label' }, 'Total sales · ' + range.label), h('div', { class: 'hero-card-value' }, m(a.totalSales))),
        donut([
          { value: a.collected, color: 'var(--emerald)' },
          { value: Math.max(0, a.outstanding - a.overdue), color: 'var(--amber)' },
          { value: a.overdue, color: 'var(--red)' },
        ], 'Collected', m(a.collected)),
      ),
      h('div', { class: 'hero-legend' },
        legend('var(--emerald)', 'Collected', m(a.collected)),
        legend('var(--amber)', 'Outstanding', m(a.outstanding - a.overdue)),
        legend('var(--red)', 'Overdue', m(a.overdue)),
      ),
    ));

    // KPI grid
    host.appendChild(h('div', { class: 'stat-grid' },
      statTile({ label: 'Money collected', value: m(a.collected), tone: 'emerald', iconName: 'wallet' }),
      statTile({ label: 'Outstanding', value: m(a.outstanding), tone: 'amber', iconName: 'clock' }),
      statTile({ label: 'Overdue', value: m(a.overdue), sub: `${a.overdueCount} invoice(s)`, tone: 'red', iconName: 'alert' }),
      statTile({ label: 'Avg invoice', value: m(a.avgInvoice), tone: 'indigo', iconName: 'file' }),
    ));

    // Counts row
    host.appendChild(h('div', { class: 'count-row' },
      countChip('emerald', a.paidCount, 'Paid'),
      countChip('amber', a.pendingCount, 'Pending'),
      countChip('red', a.overdueCount, 'Overdue'),
    ));

    // Quick actions
    host.appendChild(sectionTitle('Quick actions'));
    host.appendChild(h('div', { class: 'quick-actions' },
      quick('plus', 'New invoice', () => navigate('/invoices/new')),
      quick('users', 'Add customer', () => navigate('/customers/new')),
      quick('wallet', 'Record payment', () => navigate('/invoices?status=open')),
      quick('box', 'New package', () => navigate('/packages/new')),
      quick('alert', 'Overdue', () => navigate('/invoices?status=overdue')),
    ));

    // Monthly revenue chart
    host.appendChild(sectionTitle('Monthly revenue', 'Last 6 months'));
    host.appendChild(h('div', { class: 'card' }, barChart(a.monthlySeries, { fmt: m })));

    // Insights
    const insights = generateInsights(data);
    host.appendChild(sectionTitle('Insights', h('a', { class: 'link', onclick: () => navigate('/assistant') }, 'Ask a question →')));
    const insWrap = h('div', { class: 'insight-list' });
    for (const ins of insights.slice(0, 4)) {
      insWrap.appendChild(h('div', { class: `insight insight-${ins.kind}`, onclick: ins.action ? () => navigate(ins.action.path) : null },
        h('div', { class: 'insight-ico' }, icon(ins.icon, 18)),
        h('div', { class: 'insight-body' }, h('div', { class: 'insight-title' }, ins.title), h('div', { class: 'insight-text' }, ins.text)),
        ins.action ? icon('arrowRight', 16) : null,
      ));
    }
    host.appendChild(insWrap);

    // Recent invoices
    host.appendChild(sectionTitle('Recent invoices', h('a', { class: 'link', onclick: () => navigate('/invoices') }, 'View all →')));
    const recent = [...data.invoices].sort((x, y) => (y.issueDate || y.createdAt) - (x.issueDate || x.createdAt)).slice(0, 5);
    if (!recent.length) host.appendChild(h('div', { class: 'card muted center pad' }, 'No invoices yet.'));
    else {
      const list = h('div', { class: 'list' });
      for (const inv of recent) {
        const pays = data.payments.filter(p => p.invoiceId === inv.id);
        const t = computeTotals(inv, pays);
        const st = effectiveStatus(inv, t);
        list.appendChild(h('div', { class: 'list-row', onclick: () => navigate('/invoices/' + inv.id) },
          h('div', { class: 'list-main' },
            h('div', { class: 'list-title' }, inv.customerSnapshot?.name || 'Customer'),
            h('div', { class: 'list-sub' }, inv.number + ' · ' + fmtDate(inv.issueDate)),
          ),
          h('div', { class: 'list-end' }, h('div', { class: 'list-amt' }, m(t.total)), statusPill(st)),
        ));
      }
      host.appendChild(list);
    }

    // Top customers & best sellers
    if (a.topCustomers.length) {
      host.appendChild(sectionTitle('Top customers'));
      const tc = h('div', { class: 'card list' });
      for (const c of a.topCustomers.slice(0, 3)) tc.appendChild(h('div', { class: 'list-row' },
        h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, c.name), h('div', { class: 'list-sub' }, `${c.count} invoice(s)`)),
        h('div', { class: 'list-amt' }, m(c.billed))));
      host.appendChild(tc);
    }
    if (a.topItems.length) {
      host.appendChild(sectionTitle('Best sellers'));
      const ti = h('div', { class: 'card list' });
      for (const it of a.topItems.slice(0, 3)) ti.appendChild(h('div', { class: 'list-row' },
        h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, it.name), h('div', { class: 'list-sub' }, `${it.qty} sold`)),
        h('div', { class: 'list-amt' }, m(it.revenue))));
      host.appendChild(ti);
    }
    host.appendChild(h('div', { class: 'bottom-pad' }));
  }
  render();
  return host;
}

function legend(color, label, val) {
  return h('div', { class: 'legend-item' }, h('span', { class: 'legend-dot', style: { background: color } }), h('span', { class: 'legend-label' }, label), h('span', { class: 'legend-val' }, val));
}
function countChip(color, n, label) {
  return h('div', { class: `count-chip count-${color}` }, h('div', { class: 'count-n' }, n), h('div', { class: 'count-l' }, label));
}
function quick(ic, label, onclick) {
  return h('button', { class: 'quick', onclick }, h('span', { class: 'quick-ico' }, icon(ic, 20)), h('span', { class: 'quick-label' }, label));
}
export function sectionTitle(title, right) {
  return h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, title), right ? (typeof right === 'string' ? h('span', { class: 'section-right muted' }, right) : right) : null);
}
