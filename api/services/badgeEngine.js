/**
 * Rozet motoru.
 *
 * Rozetler veritabanindaki `badges` tablosunda tanimlidir; yeni rozet eklemek icin
 * kod degistirmek gerekmez, tabloya rule_type + rule_params ile satir eklemek yeterlidir.
 *
 * Desteklenen rule_type degerleri ve rule_params alanlari:
 *   questions_solved  { count }                 -> toplam dogru cozulen benzersiz soru
 *   topic_mastery     { topicSlug, count, accuracy } -> konuda N deneme ve >= %X dogruluk
 *   accuracy          { minAttempts, accuracy }  -> genel dogruluk orani
 *   points_total      { points }                -> toplam puan
 *   exams_completed   { count }                 -> bitirilen sinav sayisi
 *   videos_completed  { count }                 -> tamamlanan video sayisi
 *   cards_reviewed    { count }                 -> toplam flashcard tekrari
 *   sections_read     { count }                 -> okunan e-kitap bolumu
 */

/** Kullanicinin bir rozeti hak edip etmedigini hesaplar. */
async function evaluateRule(client, userId, badge) {
  const p = badge.rule_params || {};

  switch (badge.rule_type) {
    case 'questions_solved': {
      const { rows } = await client.query(
        `SELECT COUNT(DISTINCT question_id)::int AS n
           FROM attempts WHERE user_id = $1 AND is_correct = TRUE`,
        [userId]
      );
      return rows[0].n >= Number(p.count || 0);
    }

    case 'topic_mastery': {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE a.is_correct)::int AS correct
           FROM attempts a
           JOIN questions q ON q.id = a.question_id
           JOIN topics t ON t.id = q.topic_id
          WHERE a.user_id = $1 AND t.slug = $2`,
        [userId, p.topicSlug]
      );
      const { total, correct } = rows[0];
      if (total < Number(p.count || 0)) return false;
      return total > 0 && (correct / total) * 100 >= Number(p.accuracy || 0);
    }

    case 'accuracy': {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_correct)::int AS correct
           FROM attempts WHERE user_id = $1`,
        [userId]
      );
      const { total, correct } = rows[0];
      if (total < Number(p.minAttempts || 0)) return false;
      return total > 0 && (correct / total) * 100 >= Number(p.accuracy || 0);
    }

    case 'points_total': {
      const { rows } = await client.query('SELECT total_points FROM users WHERE id = $1', [userId]);
      return (rows[0]?.total_points || 0) >= Number(p.points || 0);
    }

    case 'exams_completed': {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM exam_sessions
          WHERE user_id = $1 AND finished_at IS NOT NULL`,
        [userId]
      );
      return rows[0].n >= Number(p.count || 0);
    }

    case 'videos_completed': {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM video_progress
          WHERE user_id = $1 AND completed = TRUE`,
        [userId]
      );
      return rows[0].n >= Number(p.count || 0);
    }

    case 'cards_reviewed': {
      const { rows } = await client.query(
        `SELECT COALESCE(SUM(total_reviews), 0)::int AS n
           FROM flashcard_reviews WHERE user_id = $1`,
        [userId]
      );
      return rows[0].n >= Number(p.count || 0);
    }

    case 'sections_read': {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM book_progress
          WHERE user_id = $1 AND completed = TRUE`,
        [userId]
      );
      return rows[0].n >= Number(p.count || 0);
    }

    default:
      return false;
  }
}

/**
 * Kullanicinin henuz kazanmadigi tum aktif rozetleri degerlendirir,
 * hak edilenleri verir ve yeni kazanilan rozetleri doner.
 */
async function checkAndAwardBadges(client, userId) {
  const { rows: candidates } = await client.query(
    `SELECT b.* FROM badges b
      WHERE b.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM user_badges ub WHERE ub.user_id = $1 AND ub.badge_id = b.id
        )`,
    [userId]
  );

  const earned = [];
  for (const badge of candidates) {
    let ok = false;
    try {
      ok = await evaluateRule(client, userId, badge);
    } catch (err) {
      console.error(`Rozet degerlendirilemedi (${badge.code}):`, err.message);
    }
    if (!ok) continue;

    const { rowCount } = await client.query(
      `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, badge.id]
    );
    if (rowCount > 0) {
      earned.push({
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
      });
    }
  }
  return earned;
}

module.exports = { checkAndAwardBadges, evaluateRule };
