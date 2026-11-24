const db = require('../db');

async function getUsedMenus(userId) {
  return db.read(`
    SELECT m.id AS menu_id, m.tarih, yh.ad AS yemekhane, o.ad AS ogun,
           d.id AS degerlendirme_id, d.puan, d.yorum
      FROM rezervasyonlar r
      JOIN menuler m ON m.id = r.menu_id
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      JOIN ogunler o ON o.id = m.ogun_id
      LEFT JOIN degerlendirmeler d
        ON d.menu_id = m.id AND d.kullanici_id = r.kullanici_id
     WHERE r.kullanici_id = ? AND r.durum = 'kullanildi'
     ORDER BY m.tarih DESC
  `, [userId]);
}

async function saveEvaluation(userId, menuId, rating, comment) {
  const used = await db.write(
    `SELECT id FROM rezervasyonlar
      WHERE kullanici_id = ? AND menu_id = ? AND durum = 'kullanildi'
      LIMIT 1`,
    [userId, menuId]
  );
  if (!used.length) {
    const error = new Error('Yalnızca kullanılmış menüler değerlendirilebilir.');
    error.sqlState = '45000';
    throw error;
  }
  await db.write(`
    INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE puan = VALUES(puan), yorum = VALUES(yorum)
  `, [userId, menuId, rating, comment || null]);
}

module.exports = { getUsedMenus, saveEvaluation };
