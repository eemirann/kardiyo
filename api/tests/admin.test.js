const {
  app,
  request,
  pool,
  query,
  resetDatabase,
  createUser,
  loginAs,
  createTopic,
  createQuestion,
  auth,
} = require('./helpers');

let topic;

beforeEach(async () => {
  await resetDatabase();
  topic = await createTopic();
});
afterAll(() => pool.end());

const validQuestion = (topicId) => ({
  topicId,
  type: 'classic',
  difficulty: 'easy',
  body: '<p>Yeni soru metni yeterince uzun</p>',
  explanation: '<p>Cozum</p>',
  options: [
    { label: 'A', text: 'Yanlis', isCorrect: false },
    { label: 'B', text: 'Dogru', isCorrect: true },
  ],
});

describe('Admin yetkilendirme', () => {
  test('normal kullanici admin uclarina erisemez', async () => {
    await createUser({ email: 'uye@test.com' });
    const token = await loginAs('uye@test.com');

    const res = await request(app).get('/api/admin/questions').set(auth(token));
    expect(res.status).toBe(403);
  });

  test('token olmadan admin uclari 401 doner', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('admin soru ekleyebilir ve soru listede gorunur', async () => {
    await createUser({ email: 'admin@test.com', role: 'admin' });
    const token = await loginAs('admin@test.com');

    const create = await request(app)
      .post('/api/admin/questions')
      .set(auth(token))
      .send(validQuestion(topic.id));
    expect(create.status).toBe(201);

    const list = await request(app).get('/api/questions?topic=ekg-analizi');
    expect(list.body.questions).toHaveLength(1);
    expect(list.body.questions[0].options).toHaveLength(2);
  });

  test('birden fazla dogru sik reddedilir', async () => {
    await createUser({ email: 'admin2@test.com', role: 'admin' });
    const token = await loginAs('admin2@test.com');

    const payload = validQuestion(topic.id);
    payload.options[0].isCorrect = true;

    const res = await request(app).post('/api/admin/questions').set(auth(token)).send(payload);
    expect(res.status).toBe(400);
  });

  test('soru metnindeki script etiketi temizlenir', async () => {
    await createUser({ email: 'admin3@test.com', role: 'admin' });
    const token = await loginAs('admin3@test.com');

    const payload = validQuestion(topic.id);
    payload.body = '<p>Zararsiz metin</p><script>alert(1)</script>';

    const res = await request(app).post('/api/admin/questions').set(auth(token)).send(payload);
    expect(res.status).toBe(201);

    const { rows } = await query('SELECT body FROM questions WHERE id = $1', [res.body.id]);
    expect(rows[0].body).not.toContain('<script>');
    expect(rows[0].body).toContain('Zararsiz metin');
  });

  test('admin kendi yonetici yetkisini kaldiramaz', async () => {
    const admin = await createUser({ email: 'admin4@test.com', role: 'admin' });
    const token = await loginAs('admin4@test.com');

    const res = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set(auth(token))
      .send({ role: 'user' });

    expect(res.status).toBe(400);
  });

  test('admin kullaniciyi premium yapabilir', async () => {
    await createUser({ email: 'admin5@test.com', role: 'admin' });
    const target = await createUser({ email: 'hedef@test.com' });
    const token = await loginAs('admin5@test.com');

    const res = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set(auth(token))
      .send({ isPremium: true });

    expect(res.status).toBe(200);
    expect(res.body.user.is_premium).toBe(true);
  });
});

describe('Reklamlar', () => {
  test('premium kullaniciya reklam gosterilmez', async () => {
    const { rows: slots } = await query(
      `INSERT INTO ad_slots (code, name) VALUES ('sidebar', 'Yan kolon') RETURNING id`
    );
    await query(
      `INSERT INTO ads (slot_id, title, image_url, target_url)
       VALUES ($1, 'Test reklam', 'https://ornek.com/a.png', 'https://ornek.com')`,
      [slots[0].id]
    );

    await createUser({ email: 'ucretsiz3@test.com' });
    await createUser({ email: 'premium3@test.com', isPremium: true });

    const freeToken = await loginAs('ucretsiz3@test.com');
    const premiumToken = await loginAs('premium3@test.com');

    const free = await request(app).get('/api/ads/slot/sidebar').set(auth(freeToken));
    expect(free.body.ad).not.toBeNull();

    const premium = await request(app).get('/api/ads/slot/sidebar').set(auth(premiumToken));
    expect(premium.body.ad).toBeNull();
    expect(premium.body.hidden).toBe(true);
  });
});

describe('Sinav modu', () => {
  test('suresi dolmus sinava cevap gonderilemez', async () => {
    const { question, correctOption } = await createQuestion({ topicId: topic.id });
    const user = await createUser({ email: 'sinav@test.com' });
    const token = await loginAs('sinav@test.com');

    const { rows: examRows } = await query(
      `INSERT INTO exams (title, duration_minutes) VALUES ('Test Sinavi', 10) RETURNING id`
    );
    await query('INSERT INTO exam_questions (exam_id, question_id) VALUES ($1, $2)', [
      examRows[0].id,
      question.id,
    ]);
    // Suresi gecmis oturum
    const { rows: sessionRows } = await query(
      `INSERT INTO exam_sessions (exam_id, user_id, expires_at)
       VALUES ($1, $2, now() - interval '1 minute') RETURNING id`,
      [examRows[0].id, user.id]
    );

    const res = await request(app)
      .post(`/api/exams/sessions/${sessionRows[0].id}/answer`)
      .set(auth(token))
      .send({ questionId: question.id, optionId: correctOption.id });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EXPIRED');
  });

  test('baskasinin sinav oturumuna erisilemez', async () => {
    const owner = await createUser({ email: 'sahip@test.com' });
    await createUser({ email: 'yabanci@test.com' });
    const token = await loginAs('yabanci@test.com');

    const { rows: examRows } = await query(
      `INSERT INTO exams (title, duration_minutes) VALUES ('Test', 10) RETURNING id`
    );
    const { rows: sessionRows } = await query(
      `INSERT INTO exam_sessions (exam_id, user_id, expires_at)
       VALUES ($1, $2, now() + interval '10 minutes') RETURNING id`,
      [examRows[0].id, owner.id]
    );

    const res = await request(app)
      .get(`/api/exams/sessions/${sessionRows[0].id}`)
      .set(auth(token));

    expect(res.status).toBe(403);
  });

  test('sinav bitince skor hesaplanir ve puan yazilir', async () => {
    const q1 = await createQuestion({ topicId: topic.id, difficulty: 'easy' });
    const q2 = await createQuestion({ topicId: topic.id, difficulty: 'easy' });
    await createUser({ email: 'bitir@test.com' });
    const token = await loginAs('bitir@test.com');

    const { rows: examRows } = await query(
      `INSERT INTO exams (title, duration_minutes) VALUES ('Skor Testi', 30) RETURNING id`
    );
    for (const q of [q1, q2]) {
      await query('INSERT INTO exam_questions (exam_id, question_id) VALUES ($1, $2)', [
        examRows[0].id,
        q.question.id,
      ]);
    }

    const start = await request(app).post(`/api/exams/${examRows[0].id}/start`).set(auth(token));
    const sessionId = start.body.session.id;

    // Birini dogru cevapla, digerini bos birak
    await request(app)
      .post(`/api/exams/sessions/${sessionId}/answer`)
      .set(auth(token))
      .send({ questionId: q1.question.id, optionId: q1.correctOption.id });

    const finish = await request(app).post(`/api/exams/sessions/${sessionId}/finish`).set(auth(token));

    expect(finish.status).toBe(200);
    expect(finish.body.result.correctCount).toBe(1);
    expect(finish.body.result.blankCount).toBe(1);
    expect(finish.body.result.score).toBe(50);
    expect(finish.body.result.earnedPoints).toBe(5); // easy = 5

    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.body.user.totalPoints).toBe(5);
  });
});
