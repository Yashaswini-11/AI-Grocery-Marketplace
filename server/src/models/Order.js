const mongoose = require('mongoose');

const ORDER_STATUSES = ['Placed', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];
const PAYMENT_METHODS = ['COD'];
const PAYMENT_STATUSES = ['Pending', 'Paid'];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unit: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // unit price at purchase time
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    delivery: { type: deliverySchema, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'COD' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    status: { type: String, enum: ORDER_STATUSES, default: 'Placed' },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
// One order per (user, key). Orders without a key are not affected.
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

orderSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.idempotencyKey;
    return ret;
  },
});

const Order = mongoose.model('Order', orderSchema);
Order.STATUSES = ORDER_STATUSES;

module.exports = Order;