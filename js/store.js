const STORAGE_KEY = 'water-station-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PRICE = 30;

const pesos = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

export const $ = (selector) => document.querySelector(selector);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const formatPeso = (amount) => pesos.format(amount);
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
export const formatDate = (ts) => new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
export const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
export const toInputValue = (ts) => new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const fromInputValue = (value) => new Date(value).getTime();
export const getTotal = (delivery) => delivery.qty * delivery.price;

function createSeed() {
  const now = Date.now();
  const names = [
    ['Aling Rosa Mendoza', '0917 555 0141', 'Purok 3, San Isidro'],
    ['Dennis Villanueva', '0918 555 0142', 'Phase 2, Greenfields'],
    ['Dela Cruz Boarding House', '0920 555 0143', 'Mabini Street'],
    ["Maricel's Eatery", '0921 555 0144', 'Public Market'],
    ['St. Anne Dental Clinic', '0922 555 0145', 'Rizal Avenue'],
    ['Lola Pacing', '0923 555 0146', 'Purok 1, San Isidro'],
  ];
  const customers = names.map(([name, phone, area]) => ({ id: uid(), name, phone, area }));
  const rows = [
    [0, 12, 3, 0, 1], [0, 6, 3, 2, 1], [0, 1, 4, 3, 0],
    [1, 10, 2, 0, 1], [1, 4, 2, 2, 0], [1, 0, 2, 1, 0.5],
    [2, 13, 10, 0, 1], [2, 8, 8, 8, 1], [2, 3, 8, 6, 0.5], [2, 0, 6, 6, 0],
    [3, 9, 6, 0, 1], [3, 5, 6, 6, 1], [3, 2, 6, 5, 1], [3, 0, 5, 5, 1],
    [4, 7, 5, 0, 0], [4, 2, 3, 3, 0],
    [5, 11, 1, 0, 1], [5, 2, 1, 1, 1],
  ];
  const deliveries = rows.map(([index, daysAgo, qty, back, share], order) => ({
    id: uid(),
    customerId: customers[index].id,
    at: now - daysAgo * DAY_MS - order * 3600000,
    qty,
    price: DEFAULT_PRICE,
    back,
    paid: Math.round(qty * DEFAULT_PRICE * share),
  }));
  const payments = [{ id: uid(), customerId: customers[0].id, at: now - 3 * DAY_MS, amount: 60 }];
  return { settings: { stationName: 'Blue Spring Water Station', price: DEFAULT_PRICE }, customers, deliveries, payments };
}

export function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.settings && Array.isArray(saved.customers)) return saved;
  } catch {
    return createSeed();
  }
  return createSeed();
}

export const saveData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

export function getCustomerStats(data, customerId) {
  const orders = data.deliveries.filter((item) => item.customerId === customerId).sort((a, b) => a.at - b.at);
  const payments = data.payments.filter((item) => item.customerId === customerId);
  const delivered = sum(orders, (item) => item.qty);
  const back = sum(orders, (item) => item.back);
  const received = sum(payments, (item) => item.amount);
  const balance = sum(orders, (item) => getTotal(item) - item.paid) - received;

  let credit = received;
  let oldestAt = null;
  orders.forEach((order) => {
    const due = getTotal(order) - order.paid;
    if (due <= 0) return;
    const applied = Math.min(due, credit);
    credit -= applied;
    if (due - applied > 0 && oldestAt === null) oldestAt = order.at;
  });

  return {
    onHand: delivered - back,
    balance,
    oldestDays: oldestAt === null ? null : Math.floor((Date.now() - oldestAt) / DAY_MS),
  };
}

export function getSummary(data) {
  const stats = data.customers.map((customer) => ({ customer, ...getCustomerStats(data, customer.id) }));
  const today = data.deliveries.filter((item) => isToday(item.at));
  const owing = stats.filter((item) => item.balance > 0);
  const holding = stats.filter((item) => item.onHand > 0);

  return {
    stats,
    salesToday: sum(today, getTotal),
    deliveriesToday: today.length,
    collectedToday: sum(today, (item) => item.paid) + sum(data.payments.filter((item) => isToday(item.at)), (item) => item.amount),
    totalUtang: sum(owing, (item) => item.balance),
    owing: owing.sort((a, b) => b.balance - a.balance),
    containersOut: sum(holding, (item) => item.onHand),
    holding: holding.sort((a, b) => b.onHand - a.onHand),
  };
}

export function getLastSevenDays(data) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.now() - (6 - index) * DAY_MS);
    const qty = sum(data.deliveries.filter((item) => new Date(item.at).toDateString() === day.toDateString()), (item) => item.qty);
    return { label: day.toLocaleDateString('en-PH', { weekday: 'short' }), qty };
  });
}