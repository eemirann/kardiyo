const { app, request, pool, query, resetDatabase, createUser, loginAs, auth } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => pool.end());

/** Kayit olur ve e-postaya giden ham token'i dondurur (mail gonderimi testte kapali). */
async function registerAndGetToken(email = 'yeni@test.com') {
  const crypto = require('crypto');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Sifre1234', fullName: 'Yeni Kullanici' });
  expect(res.status).toBe(201);

  // Token veritabaninda ozetli durdugu icin ham degeri geri alamayiz; testte
  // bilinen bir token yazip ozetini kaydediyoruz.
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await query(
    `UPDATE email_verification_tokens SET token_hash = $1
      WHERE user_id = (SELECT id FROM users WHERE email = $2) AND used_at IS NULL`,
    [hash, email]
  );
  return raw;
}

describe('Kimlik dogrulama', () => {
  test('kayit olan kullanici oturum acmaz, dogrulama bekler', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'yeni@test.com', password: 'Sifre1234', fullName: 'Yeni Kullanici' });

    expect(res.status).toBe(201);
    expect(res.body.pendingVerification).toBe(true);
    expect(res.body.email).toBe('yeni@test.com');
    // Dogrulanmadan token verilmemeli
    expect(res.body.accessToken).toBeUndefined();
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
    expect(res.body.user.emailVerified).toBe(true);
  });
});

describe('E-posta dogrulama', () => {
  test('dogrulanmamis kullanici giris yapamaz', async () => {
    await createUser({ email: 'bekleyen@test.com', emailVerified: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bekleyen@test.com', password: 'Sifre1234' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('gecerli bag oturum acar ve kullaniciyi dogrulanmis isaretler', async () => {
    const token = await registerAndGetToken('dogrula@test.com');

    const res = await request(app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.emailVerified).toBe(true);

    // Artik normal giris de calismali
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dogrula@test.com', password: 'Sifre1234' });
    expect(login.status).toBe(200);
  });

  test('ayni bag ikinci kez calismaz', async () => {
    const token = await registerAndGetToken('tekrar@test.com');
    await request(app).post('/api/auth/verify-email').send({ token });

    const res = await request(app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  test('suresi dolmus bag reddedilir', async () => {
    const token = await registerAndGetToken('suresi@test.com');
    await query("UPDATE email_verification_tokens SET expires_at = now() - interval '1 hour'");

    const res = await request(app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  test('yeniden gonderme eski bagi gecersiz kilar', async () => {
    const eski = await registerAndGetToken('yeniden@test.com');
    await request(app).post('/api/auth/resend-verification').send({ email: 'yeniden@test.com' });

    const res = await request(app).post('/api/auth/verify-email').send({ token: eski });
    expect(res.status).toBe(400);
  });

  test('yeniden gonderme kayitli olmayan adres icin de ayni yaniti verir', async () => {
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'hicyok@test.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
