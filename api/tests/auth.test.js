const { app, request, pool, resetDatabase, createUser, loginAs, auth } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('Kimlik dogrulama', () => {
  test('kayit olan kullanici access token alir', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'yeni@test.com', password: 'Sifre1234', fullName: 'Yeni Kullanici' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('yeni@test.com');
    expect(res.body.user.role).toBe('user');
    // Sifre ozeti asla donmemeli
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  test('ayni e-posta ile ikinci kayit reddedilir', async () => {
    await createUser({ email: 'var@test.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'var@test.com', password: 'Sifre1234', fullName: 'Kopya' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  test('kisa sifre reddedilir', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'kisa@test.com', password: '123', fullName: 'Kisa Sifre' });

    expect(res.status).toBe(400);
  });

  test('yanlis sifre ile giris reddedilir', async () => {
    await createUser({ email: 'giris@test.com', password: 'DogruSifre1' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'giris@test.com', password: 'YanlisSifre1' });

    expect(res.status).toBe(401);
  });

  test('engellenmis kullanici giris yapamaz', async () => {
    const user = await createUser({ email: 'engelli@test.com' });
    await require('./helpers').query('UPDATE users SET is_blocked = TRUE WHERE id = $1', [user.id]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'engelli@test.com', password: 'Sifre1234' });

    expect(res.status).toBe(403);
  });

  test('token olmadan /me erisilemez', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('gecerli token ile /me kullaniciyi doner', async () => {
    await createUser({ email: 'ben@test.com' });
    const token = await loginAs('ben@test.com');

    const res = await request(app).get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ben@test.com');
  });
});
