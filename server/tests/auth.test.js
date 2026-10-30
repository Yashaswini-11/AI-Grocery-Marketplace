const { api, prisma, resetDatabase, registerUser, auth } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('auth', () => {
  test('register returns a token and never exposes the password hash', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'Alice@Example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('alice@example.com'); // lower-cased
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('the stored password is hashed, not plain text', async () => {
    await api().post('/api/auth/register').send({ name: 'Alice', email: 'a@example.com', password: 'password123' });
    const row = await prisma.user.findUnique({ where: { email: 'a@example.com' } });
    expect(row.passwordHash).not.toBe('password123');
    expect(row.passwordHash.startsWith('$2')).toBe(true); // bcrypt
  });

  test('duplicate email is rejected with 409', async () => {
    const body = { name: 'Alice', email: 'a@example.com', password: 'password123' };
    await api().post('/api/auth/register').send(body);
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  test('two simultaneous sign-ups with the same email create only one account', async () => {
    const body = { name: 'Alice', email: 'race@example.com', password: 'password123' };
    const results = await Promise.all([1, 2, 3].map(() => api().post('/api/auth/register').send(body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.user.count()).toBe(1);
  });

  test('weak input is rejected', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
  });

  test('login works with a different email case, fails with a wrong password', async () => {
    const { email } = await registerUser();
    const ok = await api().post('/api/auth/login').send({ email: email.toUpperCase(), password: 'password123' });
    expect(ok.status).toBe(200);
    const bad = await api().post('/api/auth/login').send({ email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  test('/me needs a valid token', async () => {
    const { token, user } = await registerUser();
    const ok = await api().get('/api/auth/me').set(auth(token));
    expect(ok.status).toBe(200);
    expect(ok.body.user.id).toBe(user.id);

    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(auth('not.a.token'))).status).toBe(401);
  });
});
