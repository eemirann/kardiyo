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

describe('Soru listeleme guvenligi', () => {
  test('soru listesinde dogru sik ve cozum sizmaz', async () => {
    await createQuestion({ topicId: topic.id });

    const res = await request(app).get('/api/questions?topic=ekg-analizi');
    expect(res.status).toBe(200);

    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain('isCorrect');
    expect(payload).not.toContain('is_correct');
    expect(payload).not.toContain('Test cozumu');
  });

  test('premium olmayan kullanici premium soruyu goremez', async () => {
    await createQuestion({ topicId: topic.id, isPremium: true });
    await createUser({ email: 'ucretsiz@test.com' });
    const token = await loginAs('ucretsiz@test.com');

    const list = await request(app).get('/api/questions?topic=ekg-analizi').set(auth(token));
    expect(list.body.questions).toHaveLength(0);
  });

  test('premium kullanici premium soruyu gorur', async () => {
    await createQuestion({ topicId: topic.id, isPremium: true });
    await createUser({ email: 'premium@test.com', isPremium: true });
    const token = await loginAs('premium@test.com');

    const list = await request(app).get('/api/questions?topic=ekg-analizi').set(auth(token));
    expect(list.body.questions).toHaveLength(1);
  });

  test('premium soruya tekil erisim 403 doner', async () => {
    const { question } = await createQuestion({ topicId: topic.id, isPremium: true });
    await createUser({ email: 'ucretsiz2@test.com' });
    const token = await loginAs('ucretsiz2@test.com');

    const res = await request(app).get(`/api/questions/${question.id}`).set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PREMIUM_REQUIRED');
  });
});

describe('Cevaplama ve puanlama', () => {
  test('dogru cevap zorluga gore puan kazandirir', async () => {
    const { question, correctOption } = await createQuestion({
      topicId: topic.id,
      difficulty: 'hard',
    });
    await createUser({ email: 'cozucu@test.com' });
    const token = await loginAs('cozucu@test.com');

    const res = await request(app)
      .post(`/api/questions/${question.id}/answer`)
      .set(auth(token))
      .send({ optionId: correctOption.id });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.pointsAwarded).toBe(20); // hard = 20
    expect(res.body.totalPoints).toBe(20);
    expect(res.body.explanation).toContain('Test cozumu');
  });

  test('ayni soruyu ikinci kez dogru cevaplamak puan kazandirmaz', async () => {
    const { question, correctOption } = await createQuestion({
      topicId: topic.id,
      difficulty: 'medium',
    });
    await createUser({ email: 'tekrar@test.com' });
    const token = await loginAs('tekrar@test.com');

    const first = await request(app)
      .post(`/api/questions/${question.id}/answer`)
      .set(auth(token))
      .send({ optionId: correctOption.id });
    expect(first.body.pointsAwarded).toBe(10);

    const second = await request(app)
      .post(`/api/questions/${question.id}/answer`)
      .set(auth(token))
      .send({ optionId: correctOption.id });

    expect(second.body.isCorrect).toBe(true);
    expect(second.body.pointsAwarded).toBe(0);
    expect(second.body.totalPoints).toBe(10); // toplam artmadi
  });

  test('yanlis cevap puan kazandirmaz ama dogru sikki gosterir', async () => {
    const { question, options, correctOption } = await createQuestion({ topicId: topic.id });
    const wrong = options.find((o) => !o.is_correct);
    await createUser({ email: 'yanlis@test.com' });
    const token = await loginAs('yanlis@test.com');

    const res = await request(app)
      .post(`/api/questions/${question.id}/answer`)
      .set(auth(token))
      .send({ optionId: wrong.id });

    expect(res.body.isCorrect).toBe(false);
    expect(res.body.pointsAwarded).toBe(0);
    expect(res.body.correctOptionId).toBe(correctOption.id);
  });

  test('baska soruya ait sik gonderilirse reddedilir', async () => {
    const a = await createQuestion({ topicId: topic.id });
    const b = await createQuestion({ topicId: topic.id });
    await createUser({ email: 'hile@test.com' });
    const token = await loginAs('hile@test.com');

    const res = await request(app)
      .post(`/api/questions/${a.question.id}/answer`)
      .set(auth(token))
      .send({ optionId: b.correctOption.id });

    expect(res.status).toBe(400);
  });

  test('giris yapmadan cevap gonderilemez', async () => {
    const { question, correctOption } = await createQuestion({ topicId: topic.id });
    const res = await request(app)
      .post(`/api/questions/${question.id}/answer`)
      .send({ optionId: correctOption.id });

    expect(res.status).toBe(401);
  });
});

describe('Rozetler ve siralama', () => {
  test('esik asilinca rozet otomatik verilir', async () => {
    await query(
      `INSERT INTO badges (code, name, description, rule_type, rule_params)
       VALUES ('ilk-adim', 'Ilk Adim', 'Ilk dogru cevap', 'questions_solved', '{"count":1}')`
    );
    const { question, correctOption } = await createQuestion({ topicId: topic.id });
    await createUser({ email: 'rozet@test.com' });
    const token = await loginAs('rozet@test.com');

    const res = await request(app)
      .post(`/api/questions/${question.id}/answer`)
      .set(auth(token))
      .send({ optionId: correctOption.id });

    expect(res.body.newBadges).toHaveLength(1);
    expect(res.body.newBadges[0].code).toBe('ilk-adim');

    // Ikinci cevapta ayni rozet tekrar verilmez
    const q2 = await createQuestion({ topicId: topic.id });
    const res2 = await request(app)
      .post(`/api/questions/${q2.question.id}/answer`)
      .set(auth(token))
      .send({ optionId: q2.correctOption.id });
    expect(res2.body.newBadges).toHaveLength(0);
  });

  test('siralama puana gore siralanir', async () => {
    const q1 = await createQuestion({ topicId: topic.id, difficulty: 'hard' });
    const q2 = await createQuestion({ topicId: topic.id, difficulty: 'easy' });

    await createUser({ email: 'birinci@test.com' });
    await createUser({ email: 'ikinci@test.com' });
    const t1 = await loginAs('birinci@test.com');
    const t2 = await loginAs('ikinci@test.com');

    await request(app).post(`/api/questions/${q1.question.id}/answer`).set(auth(t1))
      .send({ optionId: q1.correctOption.id }); // 20 puan
    await request(app).post(`/api/questions/${q2.question.id}/answer`).set(auth(t2))
      .send({ optionId: q2.correctOption.id }); // 5 puan

    const res = await request(app).get('/api/leaderboard?period=all');
    expect(res.status).toBe(200);
    expect(res.body.entries[0].points).toBe(20);
    expect(res.body.entries[0].rank).toBe(1);
    expect(res.body.entries[1].points).toBe(5);
  });
});
