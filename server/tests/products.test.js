const { api, prisma, resetDatabase, seedProducts } = require('./helpers');

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
});
afterAll(() => prisma.$disconnect());

describe('products', () => {
  test('lists products with numeric prices and pagination info', async () => {
    const res = await api().get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(7);
    expect(typeof res.body.products[0].price).toBe('number');
    expect(res.body.products[0].id).toBeTruthy();
  });

  test('search finds products by alias (kela -> Banana)', async () => {
    const res = await api().get('/api/products?q=kela');
    expect(res.body.products.map((p) => p.name)).toEqual(['Banana']);
  });

  test('search is case-insensitive and can be combined with a category', async () => {
    const res = await api().get('/api/products?q=MILK&category=Dairy');
    expect(res.body.products.map((p) => p.name)).toEqual(['Full Cream Milk']);
  });

  test('LIKE wildcards in the search are treated as plain text', async () => {
    const res = await api().get('/api/products?q=%25');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });

  test('category filter and invalid category', async () => {
    const ok = await api().get('/api/products?category=Grains');
    expect(ok.body.products.every((p) => p.category === 'Grains')).toBe(true);
    expect((await api().get('/api/products?category=Nope')).status).toBe(400);
  });

  test('get one product; bad id gives 400; unknown id gives 404', async () => {
    const list = await api().get('/api/products?q=Salt');
    const id = list.body.products[0].id;
    expect((await api().get(`/api/products/${id}`)).body.product.name).toBe('Salt');
    expect((await api().get('/api/products/not-an-id')).status).toBe(400);
    expect((await api().get('/api/products/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });
});
