const db = require('../db');

async function getReservations(userId) {
  return db.read(`
    SELECT r.id, r.menu_id, r.durum, r.ucret, r.olusturma, r.kullanma_zamani,
           r.iptal_zamani, r.porsiyon, m.tarih, yh.ad AS yemekhane, o.ad AS ogun,
           o.son_saat, TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son
      FROM rezervasyonlar r
      JOIN menuler m ON m.id = r.menu_id
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      JOIN ogunler o ON o.id = m.ogun_id
     WHERE r.kullanici_id = ?
     ORDER BY m.tarih DESC, o.sira
  `, [userId]);
}

async function reserve(userId, menuId, portion) {
  const [rows] = await db.call('CALL sp_rezervasyon_yap(?, ?, ?)', [
    userId,
    menuId,
    portion === 'yarim' ? 'yarim' : 'tam'
  ]);
  return rows[0];
}

async function cancel(userId, reservationId) {
  const [rows] = await db.call('CALL sp_rezervasyon_iptal(?, ?)', [userId, reservationId]);
  return rows[0];
}

async function loadBalance(userId, amount) {
  const [rows] = await db.call('CALL sp_bakiye_yukle(?, ?)', [userId, amount]);
  return rows[0];
}

module.exports = { getReservations, reserve, cancel, loadBalance };
