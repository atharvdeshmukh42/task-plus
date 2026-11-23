'use strict';
const $ = (id) => document.getElementById(id);
const seed = [
  [1048, 'Deccan Joinery', 24, 'Ready'],
  [1047, 'Meridian Works', 12, 'Ready'],
  [1046, 'Westline Interiors', 8, 'On hold'],
  [1045, 'Arbor Studio', 16, 'Packed'],
  [1044, 'Northfield Supply', 32, 'Ready'],
  [1043, 'Maple & Co.', 6, 'Packed']
];
const orders = seed.map(([id, customer, units, status]) => ({id, customer, units, status}));
const statusStyle = {Ready: ['', 'clock-3'], Packed: ['success', 'circle-check'], 'On hold': ['warning', 'circle-alert']};
let filter = 'All';
let lastChange = null;

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  svg.setAttribute('class', 'sw-icon');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}
function orderLabel(id) { return 'PK-' + id; }
function announce(message) { $('announcement').textContent = message; }
function rowFor(order) {
  const tr = document.createElement('tr');
  tr.setAttribute('role', 'row');
  const key = document.createElement('th');
  key.scope = 'row';
  key.className = 'sw-numeric';
  key.textContent = orderLabel(order.id);
  tr.append(key);
  tr.insertCell().textContent = order.customer;
  const unitCell = tr.insertCell();
  unitCell.className = 'sw-number';
  unitCell.textContent = order.units;
  const unitLabel = document.createElement('span');
  unitLabel.className = 'mobile-unit';
  unitLabel.textContent = order.units === 1 ? ' unit' : ' units';
  unitCell.append(unitLabel);
  const [tone, symbol] = statusStyle[order.status];
  const badge = document.createElement('span');
  badge.className = 'sw-status' + (tone ? ' sw-status--' + tone : '');
  badge.append(icon(symbol), document.createTextNode(order.status));
  tr.insertCell().append(badge);
  const actionCell = tr.insertCell();
  if (order.status === 'Ready') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sw-btn sw-btn--quiet';
    button.dataset.pack = order.id;
    button.setAttribute('aria-label', 'Mark ' + orderLabel(order.id) + ' packed');
    button.append(icon('check'), document.createTextNode('Mark packed'));
    actionCell.append(button);
  } else if (order.status === 'On hold') {
    actionCell.className = 'on-hold-note';
    actionCell.textContent = 'Awaiting stock';
  }
  return tr;
}
function render() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const shown = orders.filter(o => (filter === 'All' || o.status === filter) &&
    (orderLabel(o.id) + ' ' + o.customer).toLocaleLowerCase().includes(query));
  $('rows').replaceChildren(...shown.map(rowFor));
  $('empty').hidden = shown.length > 0;
  $('summary').textContent = shown.length + ' of ' + orders.length + ' pick lists';
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
}
function notice(message, reversible) {
  $('notice-text').textContent = message;
  $('notice').hidden = false;
  $('undo').hidden = !reversible;
  announce(message + (reversible ? '. Undo available.' : ''));
}
function resetFilters() { filter = 'All'; $('search').value = ''; }
$('theme').addEventListener('change', e => { document.body.dataset.swTheme = e.target.value; });
$('filters').addEventListener('click', e => {
  const button = e.target.closest('[data-filter]');
  if (!button) return;
  filter = button.dataset.filter;
  render();
  announce($('summary').textContent);
});
$('search').addEventListener('input', () => { render(); announce($('summary').textContent); });
$('clear').addEventListener('click', () => { resetFilters(); render(); $('search').focus(); announce($('summary').textContent); });
$('rows').addEventListener('click', e => {
  const button = e.target.closest('[data-pack]');
  if (!button) return;
  const current = [...$('rows').querySelectorAll('[data-pack]')];
  const index = current.indexOf(button);
  const order = orders.find(o => o.id === Number(button.dataset.pack));
  if (!order || order.status !== 'Ready') return;
  order.status = 'Packed';
  lastChange = order;
  render();
  notice(orderLabel(order.id) + ' marked packed', true);
  const remaining = [...$('rows').querySelectorAll('[data-pack]')];
  (remaining[Math.min(index, remaining.length - 1)] || $('undo')).focus();
});
$('undo').addEventListener('click', () => {
  if (!lastChange) return;
  const order = lastChange;
  order.status = 'Ready';
  lastChange = null;
  render();
  notice(orderLabel(order.id) + ' returned to Ready', false);
  ($('rows').querySelector('[data-pack="' + order.id + '"]') || $('search')).focus();
});
$('new').addEventListener('click', () => { $('create-dialog').showModal(); });
$('cancel').addEventListener('click', () => { $('create-dialog').close(); });
$('create-dialog').addEventListener('close', () => { $('create-form').reset(); $('customer').setCustomValidity(''); $('new').focus(); });
$('customer').addEventListener('input', () => { $('customer').setCustomValidity(''); });
$('create-form').addEventListener('submit', e => {
  e.preventDefault();
  const customer = $('customer').value.trim();
  if (!customer) {
    $('customer').setCustomValidity('Enter a customer name.');
    $('customer').reportValidity();
    return;
  }
  const id = Math.max(...orders.map(o => o.id)) + 1;
  orders.unshift({id, customer, units: Number($('units').value), status: 'Ready'});
  resetFilters();
  lastChange = null;
  render();
  $('create-dialog').close();
  notice(orderLabel(id) + ' created for ' + customer, false);
});
render();
