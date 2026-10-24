export const CATEGORIES = ['Fruits', 'Vegetables', 'Dairy', 'Grains', 'Snacks', 'Household'];

export const ORDER_STATUSES = ['Placed', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function formatPrice(value) {
  return inr.format(value);
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function shortOrderId(id) {
  return id.slice(-8).toUpperCase();
}

export function stockLabel(stock) {
  if (stock <= 0) return { text: 'Out of stock', className: 'text-red-600' };
  if (stock <= 10) return { text: `Only ${stock} left`, className: 'text-amber-600' };
  return { text: 'In stock', className: 'text-green-700' };
}
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}