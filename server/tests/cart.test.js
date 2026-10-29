const { api, prisma, resetDatabase, seedProducts, registerUser, auth, addToCart } = require('./helpers');

let p;
beforeEach(async () => {
  await resetDatabase();
  p = await seedProducts();
});
afterAll(() => prisma.$disconnect());

describe('cart', () => {
  test('cart requires login', async () => {
    expect((await api().get('/api/cart')).status).toBe(401);
  });

  test('adding the same product twice merges the quantity; totals come from the database', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Full Cream Milk'].id, 2);
    const res = await addToCart(token, p['Full Cream Milk'].id, 1);

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(3);
    expect(res.body.cart.total).toBe(204); // 3 x 68
  });

  test('items keep the order they were added in', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Full Cream Milk'].id, 1);
    const res = await addToCart(token, p['Eggs'].id, 6);
    expect(res.body.cart.items.map((i) => i.name)).toEqual(['Full Cream Milk', 'Eggs']);
    expect(res.body.cart.itemCount).toBe(7);
  });

  test('cannot add more than the stock or more than 99', async () => {
    const { token } = await registerUser();
    const tooMany = await addToCart(token, p['Full Cream Milk'].id, 11); // stock is 10
    expect(tooMany.status).toBe(409);
    expect((await addToCart(token, p['Eggs'].id, 100)).status).toBe(400);
    expect((await addToCart(token, p['Eggs'].id, 0)).status).toBe(400);
  });

  test('update and remove', async () => {
    const { token } = await registerUser();
    await addToCart(token, p['Eggs'].id, 2);

    const updated = await api().patch(`/api/cart/items/${p['Eggs'].id}`).set(auth(token)).send({ quantity: 5 });
    expect(updated.body.cart.items[0].quantity).toBe(5);

    const removed = await api().delete(`/api/cart/items/${p['Eggs'].id}`).set(auth(token));
    expect(removed.body.cart.items).toHaveLength(0);

    const again = await api().delete(`/api/cart/items/${p['Eggs'].id}`).set(auth(token));
    expect(again.status).toBe(404);
  });

  test('every user has their own cart', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await addToCart(a.token, p['Eggs'].id, 3);
    const res = await api().get('/api/cart').set(auth(b.token));
    expect(res.body.cart.items).toHaveLength(0);
  });
});
