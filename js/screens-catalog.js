// Products/services and packages screens.
import { h, icon, navigate, state, toast, modal, frag, confirmDialog } from './lib.js';
import { pageHeader, fieldRow, textInput, textArea, selectInput, loadAccountData, stickyActions } from './screens-common.js';
import { Items, Packages, uid } from './db.js';
import { money } from './format.js';
import { packagePrice } from './screens-invoices.js';
import { writeText } from './intelligence.js';

const CATEGORIES = ['Design', 'Web', 'Consulting', 'Print', 'Labour', 'Materials', 'Subscription', 'Other'];
const UNITS = ['each', 'hour', 'day', 'month', 'project', 'pack', 'unit'];

// ---------- Products & services ----------
export async function itemsScreen() {
  const data = await loadAccountData();
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });
  let query = '', typeFilter = 'all';

  function render() {
    host.innerHTML = '';
    host.appendChild(pageHeader('Products & services', { back: '/more', actions: h('button', { class: 'btn btn-primary btn-sm', onclick: () => editItem(null, data, render) }, icon('plus', 16), 'New') }));
    host.appendChild(h('div', { class: 'search-bar' }, icon('search', 18), textInput({ placeholder: 'Search…', value: query, oninput: e => { query = e.target.value; draw(); } })));
    const chips = h('div', { class: 'chip-row' });
    for (const [k, l] of [['all', 'All'], ['service', 'Services'], ['product', 'Products']]) chips.appendChild(h('button', { class: 'chip' + (typeFilter === k ? ' on' : ''), onclick: () => { typeFilter = k; render(); } }, l));
    host.appendChild(chips);
    const listHost = h('div', {}); host.appendChild(listHost); host.appendChild(h('div', { class: 'bottom-pad' }));
    function draw() {
      let rows = data.items.slice();
      if (typeFilter !== 'all') rows = rows.filter(i => (i.type || 'service') === typeFilter);
      if (query) { const q = query.toLowerCase(); rows = rows.filter(i => [i.name, i.category, i.description].some(f => (f || '').toLowerCase().includes(q))); }
      rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      listHost.innerHTML = '';
      if (!rows.length) { listHost.appendChild(h('div', { class: 'empty pad' }, h('div', { class: 'empty-ico' }, icon('tag', 28)), h('h3', {}, data.items.length ? 'No matches' : 'No items yet'), h('p', { class: 'muted' }, 'Save reusable products & services to add them to invoices fast.'), h('button', { class: 'btn btn-primary', onclick: () => editItem(null, data, render) }, 'Add item'))); return; }
      const list = h('div', { class: 'list' });
      for (const it of rows) list.appendChild(h('div', { class: 'list-row', onclick: () => editItem(it, data, render) },
        it.imageDataUrl ? h('img', { class: 'thumb', src: it.imageDataUrl }) : h('div', { class: 'thumb ph' }, icon(it.type === 'product' ? 'box' : 'tag', 18)),
        h('div', { class: 'list-main' }, h('div', { class: 'list-title' }, it.name), h('div', { class: 'list-sub' }, (it.category || '') + ' · ' + (it.unit || 'each') + (it.taxable === false ? ' · no tax' : ''))),
        h('div', { class: 'list-amt' }, m(it.price)),
      ));
      listHost.appendChild(list);
    }
    draw();
  }
  render();
  return host;
}

function editItem(item, data, onDone) {
  const isNew = !item;
  const it = item ? { ...item } : { name: '', category: CATEGORIES[0], description: '', price: 0, taxable: true, unit: 'each', type: 'service', notes: '', imageDataUrl: '' };
  const descInput = textArea({ value: it.description, oninput: e => (it.description = e.target.value) });
  const body = h('div', {},
    fieldRow('Name *', textInput({ value: it.name, placeholder: 'e.g. Logo Concept', oninput: e => (it.name = e.target.value) })),
    h('div', { class: 'grid-2' },
      fieldRow('Type', selectInput([['service', 'Service'], ['product', 'Product']].map(([v, l]) => ({ value: v, label: l })), { value: it.type, onchange: e => (it.type = e.target.value) })),
      fieldRow('Category', selectInput(CATEGORIES.map(c => ({ value: c, label: c })), { value: it.category, onchange: e => (it.category = e.target.value) })),
    ),
    h('div', { class: 'grid-2' },
      fieldRow('Price', textInput({ type: 'number', step: '0.01', value: it.price, oninput: e => (it.price = parseFloat(e.target.value) || 0) })),
      fieldRow('Unit', selectInput(UNITS.map(u => ({ value: u, label: u })), { value: it.unit, onchange: e => (it.unit = e.target.value) })),
    ),
    h('label', { class: 'field' }, h('span', { class: 'field-label row-between' }, h('span', {}, 'Description'), h('button', { class: 'btn btn-text btn-xs', onclick: () => { descInput.value = writeText(it.type === 'product' ? 'productDesc' : 'serviceDesc', it); it.description = descInput.value; } }, icon('sparkles', 14), 'Suggest')), descInput),
    h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: it.taxable !== false, onchange: e => (it.taxable = e.target.checked) }), h('span', {}, 'Taxable')),
    fieldRow('Internal notes', textInput({ value: it.notes || '', oninput: e => (it.notes = e.target.value) })),
  );
  const mm = modal({
    title: isNew ? 'New item' : 'Edit item', size: 'md', body,
    actions: frag(
      !isNew ? h('button', { class: 'btn btn-text danger', onclick: async () => { if (await confirmDialog({ title: 'Delete item?', message: `${it.name} will be removed.`, confirmText: 'Delete', danger: true })) { await Items.remove(it.id); mm.close(); toast('Item deleted', 'success'); onDone(); } } }, 'Delete') : h('span'),
      h('button', { class: 'btn btn-primary', onclick: async () => { if (!it.name.trim()) return toast('Name is required', 'warn'); await Items.save(it, state.account.id); mm.close(); toast('Saved', 'success'); onDone(); } }, 'Save'),
    ),
  });
}

// ---------- Packages ----------
export async function packagesScreen() {
  const data = await loadAccountData();
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });
  host.appendChild(pageHeader('Packages', { back: '/more', actions: h('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate('/packages/new') }, icon('plus', 16), 'New') }));
  if (!data.packages.length) {
    host.appendChild(h('div', { class: 'empty pad' }, h('div', { class: 'empty-ico' }, icon('box', 28)), h('h3', {}, 'No packages yet'), h('p', { class: 'muted' }, 'Bundle services into one-tap packages, e.g. a "Premium Website Package".'), h('button', { class: 'btn btn-primary', onclick: () => navigate('/packages/new') }, 'Create package')));
    return host;
  }
  const list = h('div', {});
  for (const p of data.packages) {
    list.appendChild(h('div', { class: 'card pkg-card', onclick: () => navigate('/packages/' + p.id + '/edit') },
      h('div', { class: 'pkg-head' }, h('div', { class: 'pkg-ico' }, icon('box', 20)), h('div', {}, h('div', { class: 'pkg-name' }, p.name), h('div', { class: 'muted small' }, `${p.items?.length || 0} item${(p.items?.length || 0) === 1 ? '' : 's'}`)), h('div', { class: 'pkg-price' }, m(packagePrice(p)))),
      p.description ? h('div', { class: 'muted small' }, p.description) : null,
      h('div', { class: 'pkg-items' }, ...(p.items || []).slice(0, 6).map(i => h('span', { class: 'pkg-chip' }, i.name))),
    ));
  }
  host.appendChild(list); host.appendChild(h('div', { class: 'bottom-pad' }));
  return host;
}

export async function packageEditScreen({ id }) {
  const isNew = !id;
  let p = { name: '', description: '', price: '', items: [] };
  if (!isNew) { const existing = await Packages.get(id); if (!existing) return h('div', {}, pageHeader('Not found', { back: '/packages' })); p = JSON.parse(JSON.stringify(existing)); }
  const data = await loadAccountData();
  const cur = data.business?.currency || 'USD';
  const m = v => money(v, cur);
  const host = h('div', { class: 'screen scroll' });

  function render() {
    host.innerHTML = '';
    host.appendChild(pageHeader(isNew ? 'New package' : 'Edit package', { back: '/packages' }));
    host.appendChild(h('div', { class: 'card' },
      fieldRow('Package name *', textInput({ value: p.name, placeholder: 'Premium Website Package', oninput: e => (p.name = e.target.value) })),
      fieldRow('Description', textArea({ rows: 2, value: p.description, oninput: e => (p.description = e.target.value) })),
    ));

    const itemsCard = h('div', { class: 'card' });
    const drawItems = () => {
      itemsCard.innerHTML = '';
      if (!p.items.length) itemsCard.appendChild(h('div', { class: 'muted small center pad-sm' }, 'Add items to this package.'));
      p.items.forEach((it, idx) => {
        itemsCard.appendChild(h('div', { class: 'line-edit' },
          h('div', { class: 'line-edit-top' }, textInput({ value: it.name, placeholder: 'Item name', oninput: e => (it.name = e.target.value) }), h('button', { class: 'icon-btn sm', onclick: () => { p.items.splice(idx, 1); drawItems(); drawPrice(); } }, icon('trash', 16))),
          textInput({ class: 'input line-desc', placeholder: 'Description', value: it.description || '', oninput: e => (it.description = e.target.value) }),
          h('div', { class: 'line-edit-grid' },
            miniNum('Qty', it.qty || 1, v => { it.qty = v; drawPrice(); }),
            miniNum('Price', it.price || 0, v => { it.price = v; drawPrice(); }),
            h('label', { class: 'tax-toggle' }, h('input', { type: 'checkbox', checked: it.taxable !== false, onchange: e => (it.taxable = e.target.checked) }), h('span', {}, 'Tax')),
          ),
        ));
      });
      itemsCard.appendChild(h('div', { class: 'add-item-row' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { p.items.push({ name: '', description: '', qty: 1, price: 0, taxable: true }); drawItems(); } }, icon('plus', 16), 'Blank item'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => pickCatalogItem(data, p, () => { drawItems(); drawPrice(); }) }, icon('tag', 16), 'From catalog'),
      ));
    };
    drawItems();
    host.appendChild(h('div', { class: 'detail-section' }, h('div', { class: 'detail-section-title' }, 'Package items'), itemsCard));

    const priceCard = h('div', { class: 'card' });
    const drawPrice = () => {
      priceCard.innerHTML = '';
      const computed = (p.items || []).reduce((s, i) => s + Number(i.qty || 1) * Number(i.price || 0), 0);
      priceCard.append(
        h('div', { class: 'row-between' }, h('span', { class: 'muted' }, 'Sum of items'), h('strong', {}, m(computed))),
        fieldRow('Package price (leave blank to use sum)', textInput({ type: 'number', step: '0.01', value: p.price, placeholder: String(computed), oninput: e => (p.price = e.target.value) })),
      );
    };
    drawPrice();
    host.appendChild(h('div', { class: 'detail-section' }, h('div', { class: 'detail-section-title' }, 'Pricing'), priceCard));

    host.appendChild(stickyActions(
      !isNew ? h('button', { class: 'btn btn-text danger', onclick: async () => { if (await confirmDialog({ title: 'Delete package?', message: `${p.name} will be removed.`, confirmText: 'Delete', danger: true })) { await Packages.remove(id); toast('Deleted', 'success'); navigate('/packages'); } } }, 'Delete') : h('button', { class: 'btn btn-ghost', onclick: () => navigate('/packages') }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: async () => { if (!p.name.trim()) return toast('Name is required', 'warn'); if (p.price === '') delete p.price; await Packages.save(p, state.account.id); toast('Package saved', 'success'); navigate('/packages'); } }, 'Save package'),
    ));
    host.appendChild(h('div', { class: 'bottom-pad-lg' }));
  }
  render();
  return host;
}

function miniNum(label, value, onset) { return h('label', { class: 'mini-field' }, h('span', {}, label), h('input', { class: 'input', type: 'number', step: '0.01', value, oninput: e => onset(parseFloat(e.target.value) || 0) })); }

function pickCatalogItem(data, p, done) {
  import('./screens-common.js').then(({ pickerModal }) => {
    pickerModal({
      title: 'Add from catalog', items: data.items, searchKeys: ['name', 'category'],
      emptyText: 'No saved items yet.',
      render: it => h('div', { class: 'picker-row' }, h('div', {}, h('div', { class: 'picker-title' }, it.name), h('div', { class: 'muted small' }, money(it.price, data.business?.currency))), icon('plus', 16)),
      onPick: it => { p.items.push({ name: it.name, description: it.description || '', qty: 1, price: Number(it.price) || 0, taxable: it.taxable !== false }); done(); },
    });
  });
}
