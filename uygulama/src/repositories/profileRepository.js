const db = require('../db');

async function getAllergens(userId) {
  const allergens = await db.read(
    'SELECT id, ad FROM alerjenler ORDER BY id'
  );
  const selected = await db.read(
    'SELECT alerjen_id FROM kullanici_alerjenleri WHERE kullanici_id = ?',
    [userId]
  );
  return {
    allergens,
    selectedIds: selected.map((row) => row.alerjen_id)
  };
}

async function saveAllergens(userId, allergenIds) {
  const connection = await db.primary.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?',
      [userId]
    );
    for (const allergenId of allergenIds) {
      await connection.execute(
        'INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES (?, ?)',
        [userId, Number(allergenId)]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { getAllergens, saveAllergens };
