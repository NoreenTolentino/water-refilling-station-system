import { $, fromInputValue, getCustomerStats, getTotal, formatPeso, loadData, saveData, toInputValue, uid } from './store.js';
import { renderCustomers, renderDashboard, renderDeliveries, renderSidebar } from './render.js';

const TOAST_MS = 6000;
const TITLES = { dashboard: 'Dashboard', customers: 'Customers', deliveries: 'Deliveries' };

let data = loadData();
let toastTimer = null;

const findCustomer = (id) => data.customers.find((item) => item.id === id);
const num = (selector) => Number($(selector).value);

function render() {
  renderSidebar(data);
  renderDashboard(data);
  renderCustomers(data, { search: $('#customerSearch').value, filter: $('#customerFilter').value });
  renderDeliveries(data, $('#deliverySearch').value);
}

function showToast(message, onUndo) {
  $('#toastMessage').textContent = message;
  $('#toastUndo').onclick = () => {
    $('#toast').hidden = true;
    onUndo();
  };
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, TOAST_MS);
}

function mutate(change, message) {
  const snapshot = JSON.stringify(data);
  change();
  saveData(data);
  render();
  showToast(message, () => {
    data = JSON.parse(snapshot);
    saveData(data);
    render();
  });
}

function setView(view) {
  document.body.dataset.view = view;
  $('#pageTitle').textContent = TITLES[view];
  document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('active', button.dataset.nav === view));
}

function fillCustomerSelect(selector, selectedId) {
  $(selector).innerHTML = data.customers
    .map((customer) => `<option value="${customer.id}" ${customer.id === selectedId ? 'selected' : ''}>${customer.name.replace(/[<>&"]/g, '')}</option>`)
    .join('');
}

function openCustomerForm(customer = null) {
  $('#customerTitle').textContent = customer ? 'Edit customer' : 'Add customer';
  $('#customerId').value = customer?.id ?? '';
  $('#customerName').value = customer?.name ?? '';
  $('#customerPhone').value = customer?.phone ?? '';
  $('#customerArea').value = customer?.area ?? '';
  $('#customerDialog').showModal();
}

function updateDeliveryHint() {
  const total = num('#deliveryQty') * num('#deliveryPrice');
  const owed = Math.max(total - num('#deliveryPaid'), 0);
  $('#deliveryHint').textContent = `Total ${formatPeso(total || 0)}. Added to utang: ${formatPeso(owed || 0)}.`;
}

function openDeliveryForm({ delivery = null, customerId = null } = {}) {
  if (!data.customers.length) return openCustomerForm();
  $('#deliveryTitle').textContent = delivery ? 'Edit delivery' : 'New delivery';
  $('#deliveryId').value = delivery?.id ?? '';
  fillCustomerSelect('#deliveryCustomer', delivery?.customerId ?? customerId);
  $('#deliveryDate').value = toInputValue(delivery?.at ?? Date.now());
  $('#deliveryQty').value = delivery?.qty ?? 1;
  $('#deliveryPrice').value = delivery?.price ?? data.settings.price;
  $('#deliveryBack').value = delivery?.back ?? 0;
  $('#deliveryPaid').value = delivery?.paid ?? 0;
  updateDeliveryHint();
  $('#deliveryDialog').showModal();
}

function updatePaymentHint() {
  const customer = findCustomer($('#paymentCustomer').value);
  if (!customer) return;
  const { balance } = getCustomerStats(data, customer.id);
  $('#paymentHint').textContent = balance > 0 ? `Current balance: ${formatPeso(balance)}` : 'No unpaid balance.';
  $('#paymentAmount').value = balance > 0 ? balance : '';
}

function openPaymentForm(customerId = null) {
  if (!data.customers.length) return openCustomerForm();
  fillCustomerSelect('#paymentCustomer', customerId);
  updatePaymentHint();
  $('#paymentDialog').showModal();
}

function saveCustomer(event) {
  event.preventDefault();
  const id = $('#customerId').value;
  const values = { name: $('#customerName').value.trim(), phone: $('#customerPhone').value.trim(), area: $('#customerArea').value.trim() };
  mutate(() => {
    if (id) Object.assign(findCustomer(id), values);
    else data.customers.push({ id: uid(), ...values });
  }, id ? 'Customer updated' : 'Customer added');
  $('#customerDialog').close();
}

function saveDelivery(event) {
  event.preventDefault();
  const id = $('#deliveryId').value;
  const total = num('#deliveryQty') * num('#deliveryPrice');
  const values = {
    customerId: $('#deliveryCustomer').value,
    at: fromInputValue($('#deliveryDate').value),
    qty: num('#deliveryQty'),
    price: num('#deliveryPrice'),
    back: num('#deliveryBack'),
    paid: Math.min(num('#deliveryPaid'), total),
  };
  mutate(() => {
    if (id) Object.assign(data.deliveries.find((item) => item.id === id), values);
    else data.deliveries.push({ id: uid(), ...values });
  }, id ? 'Delivery updated' : 'Delivery recorded');
  $('#deliveryDialog').close();
}

function savePayment(event) {
  event.preventDefault();
  const payment = { id: uid(), customerId: $('#paymentCustomer').value, at: Date.now(), amount: num('#paymentAmount') };
  mutate(() => data.payments.push(payment), `${formatPeso(payment.amount)} received`);
  $('#paymentDialog').close();
}

function savePrices(event) {
  event.preventDefault();
  mutate(() => {
    data.settings.stationName = $('#stationInput').value.trim();
    data.settings.price = num('#priceInput');
  }, 'Settings saved');
  $('#pricesDialog').close();
}

function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === 'deliver') openDeliveryForm({ customerId: id });
  if (action === 'pay') openPaymentForm(id);
  if (action === 'edit-customer') openCustomerForm(findCustomer(id));
  if (action === 'edit-delivery') openDeliveryForm({ delivery: data.deliveries.find((item) => item.id === id) });
  if (action === 'delete-delivery') mutate(() => { data.deliveries = data.deliveries.filter((item) => item.id !== id); }, 'Delivery deleted');
  if (action === 'delete-customer') {
    mutate(() => {
      data.customers = data.customers.filter((item) => item.id !== id);
      data.deliveries = data.deliveries.filter((item) => item.customerId !== id);
      data.payments = data.payments.filter((item) => item.customerId !== id);
    }, 'Customer and records deleted');
  }
}

function exportCsv() {
  const lines = [['Customer', 'Phone', 'Area', 'Containers on hand', 'Balance']];
  data.customers.forEach((customer) => {
    const { onHand, balance } = getCustomerStats(data, customer.id);
    lines.push([customer.name, customer.phone, customer.area, onHand, balance]);
  });
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = 'customers.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function openPrices() {
  $('#stationInput').value = data.settings.stationName;
  $('#priceInput').value = data.settings.price;
  $('#pricesDialog').showModal();
}

function init() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.nav)));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

  $('#newDelivery').addEventListener('click', () => openDeliveryForm());
  $('#newDelivery2').addEventListener('click', () => openDeliveryForm());
  $('#newPayment').addEventListener('click', () => openPaymentForm());
  $('#newCustomer').addEventListener('click', () => openCustomerForm());
  $('#openPrices').addEventListener('click', openPrices);
  $('#exportCsv').addEventListener('click', exportCsv);

  $('#customerForm').addEventListener('submit', saveCustomer);
  $('#deliveryForm').addEventListener('submit', saveDelivery);
  $('#paymentForm').addEventListener('submit', savePayment);
  $('#pricesForm').addEventListener('submit', savePrices);

  ['#deliveryQty', '#deliveryPrice', '#deliveryPaid'].forEach((selector) => $(selector).addEventListener('input', updateDeliveryHint));
  $('#paymentCustomer').addEventListener('change', updatePaymentHint);

  $('#customerSearch').addEventListener('input', render);
  $('#customerFilter').addEventListener('change', render);
  $('#deliverySearch').addEventListener('input', render);
  $('#customerRows').addEventListener('click', handleTableClick);
  $('#deliveryRows').addEventListener('click', handleTableClick);

  render();
}

init();