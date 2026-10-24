const mongoose = require('mongoose');

const CATEGORIES = ['Fruits', 'Vegetables', 'Dairy', 'Grains', 'Snacks', 'Household'];
const UNITS = ['kg', 'g', 'litre', 'ml', 'piece'];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    price: { type: Number, required: true, min: 0 }, // INR per one `unit`
    imageUrl: { type: String, default: '' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, required: true, enum: UNITS },
    aliases: { type: [String], default: [] },
  },
  { timestamps: true }
);

productSchema.index({ category: 1, name: 1 });
productSchema.index({ name: 1 });

productSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Product = mongoose.model('Product', productSchema);
Product.CATEGORIES = CATEGORIES;
Product.UNITS = UNITS;

module.exports = Product;