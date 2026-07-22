// Builds a professional, self-contained invoice document for preview, print (→ PDF), and download.
import { computeTotals, effectiveStatus, STATUS_META } from './model.js';
import { money, fmtDate, escapeHtml } from './format.js';

export function invoiceHTML(inv, business, payments, opts = {}) {
  const t = computeTotals(inv, payments);
  const status = effectiveStatus(inv, t);
  const accent = (business && business.accent) || '#4F46E5';
  const cust = inv.customerSnapshot || {};
  const cur = inv.currency || (business && business.currency) || 'USD';
  const m = v => money(v, cur);
  const logo = business && business.logoDataUrl
    ? `<img src="${business.logoDataUrl}" alt="logo" class="logo-img"/>`
    : `<div class="logo-fallback" style="background:${accent}">${escapeHtml((business?.businessName || 'S').slice(0, 1).toUpperCase())}</div>`;

  const rows = (inv.lineItems || []).map(li => {
    const lineTotal = li._lineTotal != null ? li._lineTotal : (Number(li.qty || 0) * Number(li.price || 0));
    return `<tr>
      <td><div class="li-name">${escapeHtml(li.name || '')}</div>${li.description ? `<div class="li-desc">${escapeHtml(li.description)}</div>` : ''}</td>
      <td class="num">${Number(li.qty || 0)}</td>
      <td class="num">${m(li.price)}</td>
      <td class="num">${li.taxable ? '✓' : '—'}</td>
      <td class="num">${m(lineTotal)}</td>
    </tr>`;
  }).join('');

  const payRows = (payments || []).length
    ? `<div class="pay-log"><div class="section-title">Payments received</div>${payments.map(p => `<div class="pay-row"><span>${fmtDate(p.date || p.createdAt)} · ${escapeHtml(p.method || 'Payment')}</span><span>${m(p.amount)}</span></div>`).join('')}</div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Invoice ${escapeHtml(inv.number || '')} — ${escapeHtml(business?.businessName || 'Snapbill')}</title>
<style>
  :root{ --accent:${accent}; }
  *{ box-sizing:border-box; }
  body{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1e293b; margin:0; background:#fff; }
  .doc{ max-width:820px; margin:0 auto; padding:40px; }
  .head{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:3px solid var(--accent); padding-bottom:24px; }
  .brand{ display:flex; gap:14px; align-items:center; }
  .logo-img{ width:60px; height:60px; border-radius:12px; object-fit:cover; }
  .logo-fallback{ width:60px; height:60px; border-radius:12px; color:#fff; font-weight:800; font-size:28px; display:flex; align-items:center; justify-content:center; }
  .biz-name{ font-size:20px; font-weight:800; }
  .biz-meta{ font-size:12.5px; color:#64748b; line-height:1.5; margin-top:2px; white-space:pre-line; }
  .inv-title{ text-align:right; }
  .inv-title h1{ margin:0; font-size:30px; letter-spacing:1px; color:var(--accent); }
  .inv-num{ font-weight:700; color:#334155; }
  .badge{ display:inline-block; margin-top:8px; padding:5px 12px; border-radius:999px; font-size:12px; font-weight:700; color:#fff; background:var(--accent); text-transform:uppercase; letter-spacing:.5px; }
  .badge.paid{ background:#059669; } .badge.overdue{ background:#dc2626; } .badge.partially_paid{ background:#7c3aed; } .badge.draft{ background:#64748b; } .badge.cancelled{ background:#94a3b8; }
  .parties{ display:flex; justify-content:space-between; gap:30px; margin:26px 0; }
  .party .section-title, .section-title{ font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; font-weight:700; margin-bottom:6px; }
  .party .name{ font-weight:700; font-size:15px; }
  .party .meta{ font-size:13px; color:#475569; line-height:1.5; white-space:pre-line; }
  .dates{ text-align:right; font-size:13px; }
  .dates div{ margin-bottom:4px; }
  table{ width:100%; border-collapse:collapse; margin-top:8px; }
  thead th{ background:#f1f5f9; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; padding:10px 12px; }
  thead th.num, td.num{ text-align:right; }
  tbody td{ padding:12px; border-bottom:1px solid #eef2f7; font-size:13.5px; vertical-align:top; }
  .li-name{ font-weight:600; } .li-desc{ font-size:12px; color:#64748b; margin-top:2px; }
  .totals{ margin-top:18px; display:flex; justify-content:flex-end; }
  .totals-box{ width:300px; }
  .tot-row{ display:flex; justify-content:space-between; padding:7px 0; font-size:13.5px; }
  .tot-row.grand{ border-top:2px solid #e2e8f0; margin-top:6px; padding-top:12px; font-size:17px; font-weight:800; }
  .tot-row.bal{ background:#f8fafc; border-radius:10px; padding:10px 12px; font-weight:800; color:var(--accent); }
  .notes{ margin-top:28px; display:flex; gap:30px; flex-wrap:wrap; }
  .notes .block{ flex:1; min-width:220px; }
  .notes .body{ font-size:12.5px; color:#475569; line-height:1.55; white-space:pre-line; }
  .pay-log{ margin-top:20px; } .pay-row{ display:flex; justify-content:space-between; font-size:12.5px; color:#475569; padding:4px 0; }
  .foot{ margin-top:34px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #eef2f7; padding-top:16px; }
  @media print{ .doc{ padding:16px; } body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  @media (max-width:600px){
    .doc{ padding:18px 14px; }
    .head{ flex-direction:column; gap:16px; }
    .inv-title{ text-align:left; }
    .parties{ flex-direction:column; gap:16px; }
    .dates{ text-align:left; }
    thead th, tbody td{ padding:8px 6px; font-size:12px; }
    .biz-name{ font-size:17px; }
    .inv-title h1{ font-size:24px; }
    .totals{ justify-content:stretch; }
    .totals-box{ width:100%; }
    table{ display:block; overflow-x:auto; white-space:nowrap; }
  }
</style></head>
<body><div class="doc">
  <div class="head">
    <div class="brand">${logo}<div>
      <div class="biz-name">${escapeHtml(business?.businessName || 'Your Business')}</div>
      <div class="biz-meta">${escapeHtml([business?.address, business?.email, business?.phone].filter(Boolean).join('\n'))}</div>
    </div></div>
    <div class="inv-title">
      <h1>INVOICE</h1>
      <div class="inv-num">${escapeHtml(inv.number || '')}</div>
      <span class="badge ${status}">${STATUS_META[status]?.label || status}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="section-title">Bill to</div>
      <div class="name">${escapeHtml(cust.name || 'Customer')}</div>
      <div class="meta">${escapeHtml([cust.company, cust.address, cust.email, cust.phone].filter(Boolean).join('\n'))}</div>
    </div>
    <div class="dates">
      <div><strong>Issued:</strong> ${fmtDate(inv.issueDate)}</div>
      <div><strong>Due:</strong> ${fmtDate(inv.dueDate)}</div>
      ${t.deposit ? `<div><strong>Deposit requested:</strong> ${m(t.deposit)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="color:#94a3b8">No items</td></tr>'}</tbody>
  </table>

  <div class="totals"><div class="totals-box">
    <div class="tot-row"><span>Subtotal</span><span>${m(t.subtotal)}</span></div>
    ${t.discount ? `<div class="tot-row"><span>Discount</span><span>-${m(t.discount)}</span></div>` : ''}
    ${t.tax ? `<div class="tot-row"><span>${escapeHtml(business?.taxLabel || 'Tax')} (${t.taxRate}%)</span><span>${m(t.tax)}</span></div>` : ''}
    <div class="tot-row grand"><span>Total</span><span>${m(t.total)}</span></div>
    ${t.paid ? `<div class="tot-row"><span>Paid</span><span>-${m(t.paid)}</span></div>` : ''}
    <div class="tot-row bal"><span>Balance due</span><span>${m(t.balance)}</span></div>
  </div></div>

  ${payRows}

  <div class="notes">
    ${business?.paymentInstructions ? `<div class="block"><div class="section-title">Payment instructions</div><div class="body">${escapeHtml(business.paymentInstructions)}</div></div>` : ''}
    ${inv.notes ? `<div class="block"><div class="section-title">Notes</div><div class="body">${escapeHtml(inv.notes)}</div></div>` : ''}
    ${inv.terms ? `<div class="block"><div class="section-title">Terms</div><div class="body">${escapeHtml(inv.terms)}</div></div>` : ''}
  </div>

  <div class="foot">Thank you for your business · Generated with Snapbill</div>
</div></body></html>`;
}

export function printInvoice(inv, business, payments) {
  const html = invoiceHTML(inv, business, payments);
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to print or save this invoice as PDF.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.onload = () => { setTimeout(() => { w.focus(); w.print(); }, 350); };
}

export function downloadInvoiceHTML(inv, business, payments) {
  const html = invoiceHTML(inv, business, payments);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Invoice-${(inv.number || 'draft').replace(/\W+/g, '-')}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareInvoice(inv, business, payments) {
  const t = computeTotals(inv, payments);
  const cur = inv.currency || business?.currency || 'USD';
  const summary = `Invoice ${inv.number} from ${business?.businessName || 'Snapbill'} — ${money(t.total, cur)} (balance ${money(t.balance, cur)}), due ${fmtDate(inv.dueDate)}.`;
  if (navigator.share) {
    try {
      let file;
      try {
        const blob = await generateInvoicePdfBlob(inv, business, payments);
        file = new File([blob], pdfFilename(inv), { type: 'application/pdf' });
      } catch {
        const html = invoiceHTML(inv, business, payments);
        file = new File([html], `Invoice-${inv.number}.html`, { type: 'text/html' });
      }
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `Invoice ${inv.number}`, text: summary, files: [file] });
        return true;
      }
      await navigator.share({ title: `Invoice ${inv.number}`, text: summary });
      return true;
    } catch { /* cancelled */ return false; }
  }
  return false;
}

// ---------- Real PDF generation (vendored jsPDF + html2canvas, lazy-loaded, fully offline once cached) ----------
function pdfFilename(inv) { return `Invoice-${(inv.number || 'draft').replace(/\W+/g, '-')}.pdf`; }

let _pdfLibsPromise = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}
export function loadPdfLibs() {
  if (_pdfLibsPromise) return _pdfLibsPromise;
  _pdfLibsPromise = (async () => {
    if (!window.jspdf) await loadScript('./js/vendor/jspdf.umd.min.js');
    if (!window.html2canvas) await loadScript('./js/vendor/html2canvas.min.js');
    if (!window.jspdf || !window.html2canvas) throw new Error('PDF engine unavailable');
  })();
  return _pdfLibsPromise;
}

async function renderInvoiceCanvas(inv, business, payments) {
  const html = invoiceHTML(inv, business, payments);
  const frame = document.createElement('iframe');
  Object.assign(frame.style, { position: 'fixed', left: '-99999px', top: '0', width: '820px', height: '1200px', border: 'none' });
  document.body.appendChild(frame);
  try {
    await new Promise((resolve) => { frame.onload = resolve; frame.srcdoc = html; });
    const doc = frame.contentDocument;
    const target = doc.querySelector('.doc') || doc.body;
    // Let the iframe report its full content height so nothing gets clipped.
    const fullHeight = Math.max(target.scrollHeight, doc.body.scrollHeight);
    frame.style.height = fullHeight + 'px';
    await new Promise(r => setTimeout(r, 50));
    const canvas = await window.html2canvas(target, { scale: 2, backgroundColor: '#ffffff', windowWidth: 820, useCORS: true });
    return canvas;
  } finally {
    frame.remove();
  }
}

export async function generateInvoicePdfBlob(inv, business, payments) {
  await loadPdfLibs();
  const canvas = await renderInvoiceCanvas(inv, business, payments);
  const { jsPDF } = window.jspdf;
  const pageW = 210, pageH = 297; // A4 in mm
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  if (imgH <= pageH) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
  } else {
    // Slice the tall canvas across multiple A4 pages.
    const pxPerPage = Math.floor((pageH * canvas.width) / imgW);
    let renderedPx = 0, page = 0;
    while (renderedPx < canvas.height) {
      const sliceH = Math.min(pxPerPage, canvas.height - renderedPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width; sliceCanvas.height = sliceH;
      sliceCanvas.getContext('2d').drawImage(canvas, 0, renderedPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      if (page > 0) pdf.addPage();
      pdf.addImage(sliceData, 'JPEG', 0, 0, imgW, (sliceH * imgW) / canvas.width);
      renderedPx += sliceH; page++;
    }
  }
  return pdf.output('blob');
}

export async function downloadInvoicePDF(inv, business, payments) {
  const blob = await generateInvoicePdfBlob(inv, business, payments);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = pdfFilename(inv);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Emails the invoice: on mobile this opens the native share sheet with the real
// PDF attached (pick Mail/Gmail/etc). On desktop, falls back to downloading the
// PDF and opening a pre-filled mailto draft so the user can attach it themselves.
export async function emailInvoice(inv, business, payments) {
  const t = computeTotals(inv, payments);
  const cur = inv.currency || business?.currency || 'USD';
  const bizName = business?.businessName || 'Snapbill';
  const subject = `Invoice ${inv.number} from ${bizName}`;
  const body = `Hi ${inv.customerSnapshot?.name || ''},\n\nPlease find attached invoice ${inv.number} for ${money(t.total, cur)}` +
    (t.balance > 0 ? ` (balance due: ${money(t.balance, cur)}, due ${fmtDate(inv.dueDate)}).` : ', which has been paid in full.') +
    `\n\nThank you,\n${business?.ownerName || ''}\n${bizName}`;

  if (navigator.share) {
    try {
      const blob = await generateInvoicePdfBlob(inv, business, payments);
      const file = new File([blob], pdfFilename(inv), { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: subject, text: body, files: [file] });
        return { ok: true, mode: 'share' };
      }
    } catch { return { ok: false, mode: 'cancelled' }; }
  }

  // Desktop / unsupported fallback: download the real PDF, then open the user's
  // email client with the message pre-filled so they can attach the downloaded file.
  await downloadInvoicePDF(inv, business, payments);
  const mailto = `mailto:${encodeURIComponent(inv.customerSnapshot?.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  return { ok: true, mode: 'mailto-download' };
}
