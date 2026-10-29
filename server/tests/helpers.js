const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/db');

const address = {
  fullName: 'Test User',
  phone: '9876543210',
  line1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
};

const api = () => request(app);

// Empties every table so each test starts from a known state.
async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE order_items, orders, cart_items, carts, products, users RESTART IDENTITY CASCADE'
  );
}

// A small fixed catalog (not the full seed) keeps the tests fast and predictable.
async function seedProducts() {
  const base = { description: '', imageUrl: '' };
  await prisma.product.createMany({
    data: [
      { ...base, name: 'Full Cream Milk', category: 'Dairy', price: 68, unit: 'litre', stock: 10, aliases: ['milk', 'doodh'] },
      { ...base, name: 'Eggs', category: 'Dairy', price: 7, unit: 'piece', stock: 100, aliases: ['egg', 'anda'] },
      { ...base, name: 'Banana', category: 'Fruits', price: 60, unit: 'kg', stock: 20, aliases: ['bananas', 'kela'] },
      { ...base, name: 'Salt', category: 'Grains', price: 25, unit: 'kg', stock: 50, aliases: ['namak'] },
      { ...base, name: 'Sugar', category: 'Grains', price: 48, unit: 'kg', stock: 50, aliases: ['cheeni'] },
      { ...base, name: 'Toor Dal', category: 'Grains', price: 150, unit: 'kg', stock: 20, aliases: ['toor', 'lentils'] },
      { ...base, name: 'Moong Dal', category: 'Grains', price: 140, unit: 'kg', stock: 20, aliases: ['moong', 'lentils'] },
    ],
  });
  const products = await prisma.product.findMany();
  return Object.fromEntries(products.map((p) => [p.name, p]));
}

let counter = 0;
async function registerUser(name = 'Test User') {
  counter += 1;
  const email = `user${counter}_${Date.now()}@example.com`;
  const res = await api().post('/api/auth/register').send({ name, email, password: 'password123' });
  return { token: res.body.token, user: res.body.user, email };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function addToCart(token, productId, quantity = 1) {
  return api().post('/api/cart/items').set(auth(token)).send({ productId, quantity });
}

module.exports = { api, prisma, address, resetDatabase, seedProducts, registerUser, auth, addToCart };
