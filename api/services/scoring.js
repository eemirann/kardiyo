/** Puanlama kurallari. */

const POINTS_BY_DIFFICULTY = { easy: 5, medium: 10, hard: 20 };

const pointsFor = (difficulty) => POINTS_BY_DIFFICULTY[difficulty] ?? POINTS_BY_DIFFICULTY.medium;

/**
 * Bir cevabi kaydeder ve hak edilen puani doner.
 *
 * Puan yalnizca kullanici o soruyu ILK KEZ dogru cevapladiginda verilir; ayni soruyu
 * tekrar cozmek puan kazandirmaz (leaderboard'un tekrar cozerek sisirilmesini engeller).
 *
 * @param client transaction icindeki pg client
 * @returns {Promise<{attemptId:number, pointsAwarded:number}>}
 */
async function recordAttempt(client, {
  userId,
  question,
  selectedOptionId,
  isCorrect,
  durationMs = null,
  examSessionId = null,
}) {
  let pointsAwarded = 0;

  if (isCorrect) {
    const { rowCount } = await client.query(
      `SELECT 1 FROM attempts
        WHERE user_id = $1 AND question_id = $2 AND is_correct = TRUE AND points_awarded > 0
        LIMIT 1`,
      [userId, question.id]
    );
    if (rowCount === 0) pointsAwarded = pointsFor(question.difficulty);
  }

  const { rows } = await client.query(
    `INSERT INTO attempts
       (user_id, question_id, selected_option_id, is_correct, points_awarded, duration_ms, exam_session_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, question.id, selectedOptionId, isCorrect, pointsAwarded, durationMs, examSessionId]
  );

  if (pointsAwarded > 0) {
    await client.query('UPDATE users SET total_points = total_points + $1 WHERE id = $2', [
      pointsAwarded,
      userId,
    ]);
  }

  return { attemptId: rows[0].id, pointsAwarded };
}

module.exports = { POINTS_BY_DIFFICULTY, pointsFor, recordAttempt };
