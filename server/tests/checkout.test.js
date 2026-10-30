const { api, prisma, address, resetDatabase, seedProducts, registerUser, auth, addToCart } = require('./helpers');

let p;
beforeEach(async () => {
  await resetDatabase();
  p = await seedProducts();
});
afterAll(() => prisma.$disconnect());

const stockOf = async (product) => (await prisma.product.findUnique({ where: { id: product.id } })).stock;
const placeOrder = (token, headers = {}) =>
  api().post('/api/orders').set(auth(token)).set(headers).send({ delivery: address });

describe('checkout (one database transaction)', () => {
  test('success: order is saved, stock is deducted and the cart is emptied', async () => {
    const { token, user } = await registerUser();
    await addToCart(token, p['Full Cream Milk'].id, 4);
    await addToCart(token, p['Eggs'].id, 12);

    const res = await placeOrder(token);

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('Placed');
    expect(res.body.order.user).toBe(user.id);
    expect(res.body.order.totalAmount).toBe(4 * 68 + 12 * 7);
    expect(res.body.order.items).toHaveLength(2);
    expect(res.body.order.delivery.city).toBe('Bengaluru');

    expect(await stockOf(p['Full Cream Milk'])).toBe(6);
    expect(await stockOf(p['Eggs'])).toBe(88);
    expect((await api().get('/api/cart').set(auth(token))).body.cart.items).toHaveLength(0);
  });

  test('the order keeps a price snapshot: changing the price later does not change old orders', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Eggs'].id, 10);
    const created = await placeOrder(token);

    await prisma.product.update({ where: { id: p['Eggs'].id }, data: { price: 99 } });

    const res = await api().get(`/api/orders/${created.body.order.id}`).set(auth(token));
    expect(res.body.order.items[0].price).toBe(7);
    expect(res.body.order.totalAmount).toBe(70);
  });

  test('an empty cart cannot be checked out', async () => {
    const { token } = await registerUser();
    expect((await placeOrder(token)).status).toBe(400);
  });

  test('invalid delivery details are rejected before anything changes', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Eggs'].id, 2);
    const res = await api().post('/api/orders').set(auth(token)).send({ delivery: { ...address, phone: '123' } });
    expect(res.status).toBe(400);
    expect(await stockOf(p['Eggs'])).toBe(100);
  });

  test('ROLLBACK: if one item is out of stock, nothing is changed', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Salt'].id, 2);
    await addToCart(token, p['Banana'].id, 5);

    // Someone else buys almost all the bananas after they were put in this cart
    await prisma.product.update({ where: { id: p['Banana'].id }, data: { stock: 1 } });

    const res = await placeOrder(token);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Only 1 kg of Banana/);
    expect(await stockOf(p['Salt'])).toBe(50); // untouched, even though Salt alone was fine
    expect(await prisma.order.count()).toBe(0);
    expect((await api().get('/api/cart').set(auth(token))).body.cart.items).toHaveLength(2);
  });

  test('a fully sold-out item gives a clear message', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Banana'].id, 2);
    await prisma.product.update({ where: { id: p['Banana'].id }, data: { stock: 0 } });
    const res = await placeOrder(token);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Banana is out of stock');
  });

  test('the database itself refuses negative stock (CHECK constraint)', async () => {
    await expect(
      prisma.product.update({ where: { id: p['Salt'].id }, data: { stock: -1 } })
    ).rejects.toThrow();
  });

  test('users cannot see each other\'s orders', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await addToCart(a.token, p['Eggs'].id, 1);
    const created = await placeOrder(a.token);

    expect((await api().get(`/api/orders/${created.body.order.id}`).set(auth(b.token))).status).toBe(404);
    expect((await api().get('/api/orders').set(auth(b.token))).body.orders).toHaveLength(0);
    expect((await api().get('/api/orders/bad-id').set(auth(a.token))).status).toBe(400);
  });
});

describe('checkout under concurrency', () => {
  test('RACE: 8 buyers want the last 3 items, exactly 3 succeed and stock never goes negative', async () => {
    await prisma.product.update({ where: { id: p['Salt'].id }, data: { stock: 3 } });

    const buyers = [];
    for (let i = 0; i < 8; i++) {
      const u = await registerUser(`Buyer ${i}`);
      await addToCart(u.token, p['Salt'].id, 1);
      buyers.push(u.token);
    }

    const results = await Promise.all(buyers.map((t) => placeOrder(t)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await stockOf(p['Salt'])).toBe(0);
    expect(await prisma.order.count()).toBe(3);
  });

  test('DEADLOCK: simultaneous checkouts sharing items in different cart orders all succeed', async () => {
    const buyers = [];
    for (let i = 0; i < 10; i++) {
      const u = await registerUser(`Buyer ${i}`);
      const order = i % 2 ? [p['Salt'], p['Sugar']] : [p['Sugar'], p['Salt']];
      for (const product of order) await addToCart(u.token, product.id, 1);
      buyers.push(u.token);
    }

    const results = await Promise.all(buyers.map((t) => placeOrder(t)));

    expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
    expect(await stockOf(p['Salt'])).toBe(40);
    expect(await stockOf(p['Sugar'])).toBe(40);
  });

  test('IDEMPOTENCY: the same key sent three times at once makes one order and deducts stock once', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Eggs'].id, 5);

    const results = await Promise.all(
      [1, 2, 3].map(() => placeOrder(token, { 'Idempotency-Key': 'double-click' }))
    );

    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.order.id)).size).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(p['Eggs'])).toBe(95);
  });

  test('IDEMPOTENCY: re-sending after success returns the same order marked duplicate', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Eggs'].id, 2);
    const first = await placeOrder(token, { 'Idempotency-Key': 'k1' });
    const second = await placeOrder(token, { 'Idempotency-Key': 'k1' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.order.id).toBe(first.body.order.id);
    expect(await stockOf(p['Eggs'])).toBe(98);
  });
});
