const CATEGORIES = ['Fruits', 'Vegetables', 'Dairy', 'Grains', 'Snacks', 'Household'];
const UNITS = ['kg', 'g', 'litre', 'ml', 'piece'];

// Prisma enum keys cannot contain spaces, so the API label differs for one status.
const ORDER_STATUS_LABELS = {
  Placed: 'Placed',
  Confirmed: 'Confirmed',
  Packed: 'Packed',
  OutForDelivery: 'Out for Delivery',
  Delivered: 'Delivered',
};
const ORDER_STATUSES = Object.values(ORDER_STATUS_LABELS); // API labels
const statusKeyFromLabel = (label) =>
  Object.keys(ORDER_STATUS_LABELS).find((k) => ORDER_STATUS_LABELS[k] === label);

module.exports = { CATEGORIES, UNITS, ORDER_STATUS_LABELS, ORDER_STATUSES, statusKeyFromLabel };
