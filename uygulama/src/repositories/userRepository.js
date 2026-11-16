const db = require('../db');

async function findByEmail(email) {
  return db.read(
    `SELECT id, ad, soyad, eposta, sifre_hash, rol, ogrenci_no, bakiye, aktif
       FROM kullanicilar WHERE eposta = ?`,
    [email]
  ).then((rows) => rows[0] || null);
}

async function getBalance(userId) {
  const rows = await db.read(
    'SELECT bakiye FROM kullanicilar WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

async function getHistory(userId) {
  return db.read(
    `SELECT id, tur, tutar, aciklama, olusturma, rezervasyon_id
       FROM bakiye_hareketleri
      WHERE kullanici_id = ?
      ORDER BY olusturma DESC, id DESC`,
    [userId]
  );
}

module.exports = { findByEmail, getBalance, getHistory };
