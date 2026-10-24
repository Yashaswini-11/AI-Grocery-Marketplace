const mongoose = require('mongoose');
const Product = require('../models/Product');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Shared by GET /products and GET /products/search
const listProducts = asyncHandler(async (req, res) => {
  const { category, q } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

  const filter = {};

  if (category) {
    if (!Product.CATEGORIES.includes(category)) {
      throw new HttpError(400, `Category must be one of: ${Product.CATEGORIES.join(', ')}`);
    }
    filter.category = category;
  }

  if (typeof q === 'string' && q.trim()) {
    const term = q.trim().slice(0, 100);
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: regex }, { aliases: regex }];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid product id');
  }
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  res.json({ success: true, product });
});

module.exports = { listProducts, getProduct };