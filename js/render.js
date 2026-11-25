import { $, escapeHtml, formatDate, formatPeso, getCustomerStats, getLastSevenDays, getSummary, getTotal } from './store.js';

const MAX_JUGS = 8;

const jugs = (count) => {
  const shown = Math.min(count, MAX_JUGS);
  return `<span class="jugs">${'<svg class="jug"><use href="#jug"/></svg>'.repeat(shown)}</span>`;
};

const empty = (text) => `<li class="list-empty">${text}</li>`;

export function renderDashboard(data) {
  const summary = getSummary(data);
  const week = getLastSevenDays(data);
  const peak = Math.max(...week.map((day) => day.qty), 1);
  const nameOf = (id) => data.customers.find((customer) => customer.id === id)?.name ?? 'Deleted customer';

  $('#kSales').textContent = formatPeso(summary.salesToday);
  $('#kSalesNote').textContent = `${summary.deliveriesToday} deliver${summary.deliveriesToday === 1 ? 'y' : 'ies'}`;
  $('#kCollected').textContent = formatPeso(summary.collectedToday);
  $('#kUtang').textContent = formatPeso(summary.totalUtang);
  $('#kUtangNote').textContent = `${summary.owing.length} customer${summary.owing.length === 1 ? '' : 's'} owing`;
  $('#kContainers').textContent = summary.containersOut;
  $('#kContainersNote').textContent = `With ${summary.holding.length} customer${summary.holding.length === 1 ? '' : 's'}`;

  $('#bars').innerHTML = week.map((day) => `
    <div class="bar-col"><span class="bar-value">${day.qty}</span><span class="bar" style="height:${Math.max((day.qty / peak) * 100, 3)}%"></span><span class="bar-label">${day.label}</span></div>`).join('');

  $('#topUtang').innerHTML = summary.owing.slice(0, 5).map(({ customer, balance, oldestDays }) => `
    <li><div><strong>${escapeHtml(customer.name)}</strong><small>${oldestDays === null ? 'Unapplied balance' : `Unpaid for ${oldestDays} day${oldestDays === 1 ? '' : 's'}`}</small></div><b class="owe">${formatPeso(balance)}</b></li>`).join('') || empty('No unpaid balances.');

  $('#topContainers').innerHTML = summary.holding.slice(0, 5).map(({ customer, onHand }) => `
    <li><div><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.area || 'No address')}</small></div>${jugs(onHand)}<b>${onHand}</b></li>`).join('') || empty('All containers are back.');

  $('#recent').innerHTML = [...data.deliveries].sort((a, b) => b.at - a.at).slice(0, 5).map((item) => `
    <li><div><strong>${escapeHtml(nameOf(item.customerId))}</strong><small>${formatDate(item.at)}, ${item.qty} gallon${item.qty === 1 ? '' : 's'}</small></div><b>${formatPeso(getTotal(item))}</b></li>`).join('') || empty('No deliveries yet.');
}

export function renderCustomers(data, { search, filter }) {
  const query = search.trim().toLowerCase();
  const rows = data.customers
    .map((customer) => ({ customer, ...getCustomerStats(data, customer.id) }))
    .filter(({ customer, balance, onHand }) => {
      const matches = `${customer.name} ${customer.area}`.toLowerCase().includes(query);
      const passes = filter === 'all' || (filter === 'utang' ? balance > 0 : onHand > 0);
      return matches && passes;
    });

  $('#customerRows').innerHTML = rows.map(({ customer, balance, onHand, oldestDays }) => `
    <tr>
      <td><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml([customer.area, customer.phone].filter(Boolean).join(', '))}</small></td>
      <td class="holds">${onHand > 0 ? `${jugs(onHand)}<b>${onHand}</b>` : '<span class="muted">None</span>'}</td>
      <td class="num">${balance > 0 ? `<b class="owe">${formatPeso(balance)}</b>` : balance < 0 ? `<span class="ok">${formatPeso(-balance)} credit</span>` : '<span class="muted">Paid up</span>'}</td>
      <td>${oldestDays === null ? '<span class="muted">None</span>' : `${oldestDays} day${oldestDays === 1 ? '' : 's'}`}</td>
      <td class="row-actions">
        <button class="chip" data-action="deliver" data-id="${customer.id}">Delivery</button>
        <button class="chip" data-action="pay" data-id="${customer.id}">Payment</button>
        <button class="link" data-action="edit-customer" data-id="${customer.id}">Edit</button>
        <button class="link danger" data-action="delete-customer" data-id="${customer.id}">Delete</button>
      </td>
    </tr>`).join('');
  $('#customerEmpty').hidden = rows.length > 0;
}

export function renderDeliveries(data, search) {
  const query = search.trim().toLowerCase();
  const rows = [...data.deliveries]
    .sort((a, b) => b.at - a.at)
    .map((item) => ({ item, customer: data.customers.find((customer) => customer.id === item.customerId) }))
    .filter(({ customer }) => (customer?.name ?? '').toLowerCase().includes(query));

  $('#deliveryRows').innerHTML = rows.map(({ item, customer }) => {
    const owed = getTotal(item) - item.paid;
    return `
    <tr>
      <td>${formatDate(item.at)}</td>
      <td><strong>${escapeHtml(customer?.name ?? 'Deleted customer')}</strong></td>
      <td class="num">${item.qty}</td>
      <td class="num">${item.back}</td>
      <td class="num">${formatPeso(getTotal(item))}</td>
      <td class="num">${formatPeso(item.paid)}</td>
      <td class="num">${owed > 0 ? `<b class="owe">${formatPeso(owed)}</b>` : '<span class="muted">0</span>'}</td>
      <td class="row-actions"><button class="link" data-action="edit-delivery" data-id="${item.id}">Edit</button><button class="link danger" data-action="delete-delivery" data-id="${item.id}">Delete</button></td>
    </tr>`;
  }).join('');
  $('#deliveryEmpty').hidden = rows.length > 0;
}

export function renderSidebar(data) {
  $('#stationName').textContent = data.settings.stationName;
  $('#pageDate').textContent = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}