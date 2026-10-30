const { api, prisma, resetDatabase, seedProducts, registerUser, auth } = require('./helpers');

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
});
afterAll(() => prisma.$disconnect());

// "Match without AI" endpoint: the same catalog matching the AI list uses after Gemini
const match = async (items) => {
  const { token } = await registerUser();
  const res = await api().post('/api/ai/match-items').set(auth(token)).send({ items });
  return res.body.items;
};

describe('catalog matcher', () => {
  test('exact names, aliases and Hindi names are matched', async () => {
    const [milk, kela, egg] = await match([{ name: 'milk' }, { name: 'kela' }, { name: 'eggs' }]);
    expect(milk.match.product.name).toBe('Full Cream Milk');
    expect(kela.match.product.name).toBe('Banana');
    expect(egg.match.product.name).toBe('Eggs');
  });

  test('a typo is still matched but flagged for review', async () => {
    const [item] = await match([{ name: 'bananna' }]);
    expect(item.status).toBe('matched');
    expect(item.match.product.name).toBe('Banana');
    expect(item.match.needsReview).toBe(true);
  });

  test('an ambiguous word offers choices instead of guessing', async () => {
    const [item] = await match([{ name: 'lentils' }]);
    expect(item.status).toBe('ambiguous');
    expect(item.candidates.map((c) => c.product.name).sort()).toEqual(['Moong Dal', 'Toor Dal']);
  });

  test('unknown items are kept as unmatched, never dropped', async () => {
    const [item] = await match([{ name: 'xyzzy' }]);
    expect(item.status).toBe('unmatched');
  });

  test('units are converted: 500 g of a per-kg item rounds up to 1 kg with a note', async () => {
    const [item] = await match([{ name: 'banana', quantity: 500, unit: 'g' }]);
    expect(item.match.quantity).toBe(1);
    expect(item.match.notes.length).toBeGreaterThan(0);
  });

  test('prices and stock come from the database as plain numbers', async () => {
    const [item] = await match([{ name: 'milk', quantity: 2, unit: 'litre' }]);
    expect(item.match.product.price).toBe(68);
    expect(item.match.lineTotal).toBe(136);
    expect(typeof item.match.product.stock).toBe('number');
  });
});
