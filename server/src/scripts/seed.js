const mongoose = require('mongoose');
require('../config/env');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const img = (name) => `https://placehold.co/600x400?text=${encodeURIComponent(name)}`;

// price = INR per one `unit`
const products = [
  // Fruits
  { name: 'Banana', category: 'Fruits', price: 60, unit: 'kg', stock: 120, aliases: ['bananas', 'kela'], description: 'Ripe yellow bananas, sold per kg.' },
  { name: 'Apple', category: 'Fruits', price: 180, unit: 'kg', stock: 80, aliases: ['apples', 'seb'], description: 'Crisp red apples.' },
  { name: 'Orange', category: 'Fruits', price: 90, unit: 'kg', stock: 90, aliases: ['oranges'], description: 'Juicy sweet oranges.' },
  { name: 'Grapes', category: 'Fruits', price: 110, unit: 'kg', stock: 60, aliases: ['grape'], description: 'Seedless green grapes.' },

  // Vegetables
  { name: 'Tomato', category: 'Vegetables', price: 40, unit: 'kg', stock: 150, aliases: ['tomatoes', 'tamatar'], description: 'Fresh red tomatoes.' },
  { name: 'Onion', category: 'Vegetables', price: 45, unit: 'kg', stock: 200, aliases: ['onions', 'pyaz'], description: 'Everyday red onions.' },
  { name: 'Potato', category: 'Vegetables', price: 35, unit: 'kg', stock: 200, aliases: ['potatoes', 'aloo'], description: 'Fresh potatoes.' },
  { name: 'Carrot', category: 'Vegetables', price: 60, unit: 'kg', stock: 100, aliases: ['carrots', 'gajar'], description: 'Sweet orange carrots.' },
  { name: 'Spinach (1 bunch)', category: 'Vegetables', price: 25, unit: 'piece', stock: 70, aliases: ['spinach', 'palak'], description: 'Fresh leafy spinach, one bunch.' },

  // Dairy
  { name: 'Full Cream Milk', category: 'Dairy', price: 68, unit: 'litre', stock: 100, aliases: ['milk', 'doodh'], description: 'Pasteurised full cream milk.' },
  { name: 'Curd', category: 'Dairy', price: 90, unit: 'kg', stock: 60, aliases: ['yogurt', 'yoghurt', 'dahi'], description: 'Fresh set curd.' },
  { name: 'Paneer', category: 'Dairy', price: 380, unit: 'kg', stock: 30, aliases: ['cottage cheese'], description: 'Soft fresh paneer.' },
  { name: 'Butter (100 g pack)', category: 'Dairy', price: 58, unit: 'piece', stock: 80, aliases: ['butter'], description: 'Salted table butter, 100 g pack.' },
  { name: 'Eggs', category: 'Dairy', price: 7, unit: 'piece', stock: 300, aliases: ['egg', 'anda'], description: 'Farm eggs, priced per egg.' },

  // Grains
  { name: 'Basmati Rice', category: 'Grains', price: 120, unit: 'kg', stock: 150, aliases: ['rice', 'chawal'], description: 'Long-grain aged basmati rice.' },
  { name: 'Wheat Flour (Atta)', category: 'Grains', price: 48, unit: 'kg', stock: 150, aliases: ['atta', 'wheat flour', 'flour'], description: 'Whole wheat chakki atta.' },
  { name: 'Toor Dal', category: 'Grains', price: 150, unit: 'kg', stock: 100, aliases: ['dal', 'toor', 'lentils'], description: 'Split pigeon peas.' },
  { name: 'Sugar', category: 'Grains', price: 48, unit: 'kg', stock: 150, aliases: ['cheeni'], description: 'Refined white sugar.' },
  { name: 'Sandwich Bread (400 g loaf)', category: 'Grains', price: 45, unit: 'piece', stock: 60, aliases: ['bread', 'sandwich bread'], description: 'Soft sliced white bread loaf.' },

  // Snacks
  { name: 'Potato Chips (pack)', category: 'Snacks', price: 20, unit: 'piece', stock: 150, aliases: ['chips', 'crisps'], description: 'Salted potato chips.' },
  { name: 'Marie Biscuits (pack)', category: 'Snacks', price: 25, unit: 'piece', stock: 120, aliases: ['biscuits', 'biscuit', 'cookies'], description: 'Light tea-time biscuits.' },
  { name: 'Roasted Peanuts (200 g pack)', category: 'Snacks', price: 40, unit: 'piece', stock: 90, aliases: ['peanuts', 'groundnuts'], description: 'Salted roasted peanuts.' },
  { name: 'Instant Noodles (pack)', category: 'Snacks', price: 14, unit: 'piece', stock: 200, aliases: ['noodles'], description: 'Masala instant noodles.' },

  // Household
  { name: 'Dishwash Liquid (500 ml)', category: 'Household', price: 99, unit: 'piece', stock: 70, aliases: ['dishwash', 'dish soap'], description: 'Lemon dishwashing liquid.' },
  { name: 'Laundry Detergent (1 kg)', category: 'Household', price: 140, unit: 'piece', stock: 60, aliases: ['detergent', 'washing powder'], description: 'Detergent powder for machine and hand wash.' },
  { name: 'Toilet Paper Roll', category: 'Household', price: 60, unit: 'piece', stock: 100, aliases: ['toilet paper', 'tissue'], description: '2-ply soft toilet paper roll.' },
  { name: 'Hand Wash (250 ml)', category: 'Household', price: 85, unit: 'piece', stock: 80, aliases: ['handwash', 'hand soap'], description: 'Antibacterial liquid hand wash.' },
].map((p) => ({ ...p, imageUrl: img(p.name) }));

async function seed() {
  await connectDB();
  await Product.deleteMany({});
  const created = await Product.insertMany(products);
  console.log(`Seeded ${created.length} products`);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});