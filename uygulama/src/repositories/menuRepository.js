const db = require('../db');

async function getCanteens() {
  return db.read('SELECT id, ad, konum, kapasite FROM yemekhaneler ORDER BY id');
}

async function getMeals() {
  return db.read('SELECT id, ad, sira, son_saat FROM ogunler ORDER BY sira');
}

async function getToday(canteenId) {
  const [menus] = await Promise.all([
    db.read(`
      SELECT m.id, m.tarih, m.ogun_id, o.ad AS ogun, m.ogrenci_fiyati,
             m.personel_fiyati, d.kapasite, d.bos_yer, d.rezerve, d.rezerve AS dolu,
             d.rezervasyon_son
        FROM menuler m
        JOIN ogunler o ON o.id = m.ogun_id
        JOIN v_menu_doluluk d ON d.menu_id = m.id
       WHERE m.yemekhane_id = ? AND m.tarih = CURDATE()
       ORDER BY o.sira
    `, [canteenId]),
    db.read(`
      SELECT vd.menu_id, vd.yemek_id, vd.yemek, vd.kalori, vd.vejetaryen,
             vd.alerjenler, vd.kategori, vd.kategori_sira
        FROM v_menu_detay vd
       WHERE vd.yemekhane_id = ? AND vd.tarih = CURDATE()
       ORDER BY vd.ogun_sira, vd.kategori_sira, vd.yemek
    `, [canteenId])
  ]);
  return { menus, foods: menus.length ? await getFoodsForMenus(menus.map((menu) => menu.id)) : [] };
}

async function getFoodsForMenus(menuIds) {
  if (!menuIds.length) return [];
  const placeholders = menuIds.map(() => '?').join(',');
  return db.read(`
    SELECT vd.menu_id, vd.yemek_id, vd.yemek, vd.kalori, vd.vejetaryen,
           vd.alerjenler, vd.kategori, vd.kategori_sira
      FROM v_menu_detay vd
     WHERE vd.menu_id IN (${placeholders})
     ORDER BY vd.ogun_sira, vd.kategori_sira, vd.yemek
  `, menuIds);
}

async function getTodayComplete(canteenId) {
  const menus = await db.read(`
    SELECT m.id, m.tarih, m.ogun_id, o.ad AS ogun, m.ogrenci_fiyati,
           m.personel_fiyati, d.kapasite, d.bos_yer, d.rezerve,
           d.rezervasyon_son
      FROM menuler m
      JOIN ogunler o ON o.id = m.ogun_id
      JOIN v_menu_doluluk d ON d.menu_id = m.id
     WHERE m.yemekhane_id = ? AND m.tarih = CURDATE()
     ORDER BY o.sira
  `, [canteenId]);
  const foods = await getFoodsForMenus(menus.map((menu) => menu.id));
  return { menus, foods };
}

async function getWeekly(canteenId, startDate) {
  const menus = await db.read(`
    SELECT m.id, m.tarih, m.ogun_id, o.ad AS ogun, o.son_saat,
           m.ogrenci_fiyati, m.personel_fiyati,
           d.kapasite, d.bos_yer, d.rezerve, d.doluluk_yuzde, d.rezervasyon_son
      FROM menuler m
      JOIN ogunler o ON o.id = m.ogun_id
      JOIN v_menu_doluluk d ON d.menu_id = m.id
     WHERE m.yemekhane_id = ? AND m.tarih BETWEEN ? AND DATE_ADD(?, INTERVAL 6 DAY)
     ORDER BY m.tarih, o.sira
  `, [canteenId, startDate, startDate]);
  const foods = await getFoodsForMenus(menus.map((menu) => menu.id));
  return { menus, foods };
}

async function createMenu({ yemekhaneId, tarih, ogunId, ogrenciFiyati, personelFiyati, yemekIds }) {
  const connection = await db.primary.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati)
       VALUES (?, ?, ?, ?, ?)`,
      [yemekhaneId, tarih, ogunId, ogrenciFiyati, personelFiyati]
    );
    for (const yemekId of yemekIds) {
      await connection.execute(
        'INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES (?, ?)',
        [result.insertId, yemekId]
      );
    }
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateMenu(menuId, { ogrenciFiyati, personelFiyati, yemekIds }) {
  const connection = await db.primary.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE menuler SET ogrenci_fiyati = ?, personel_fiyati = ? WHERE id = ?',
      [ogrenciFiyati, personelFiyati, menuId]
    );
    await connection.execute('DELETE FROM menu_yemekleri WHERE menu_id = ?', [menuId]);
    for (const yemekId of yemekIds) {
      await connection.execute(
        'INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES (?, ?)',
        [menuId, yemekId]
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

async function getAdminMenus(startDate) {
  const menus = await db.read(`
    SELECT m.id, m.tarih, m.yemekhane_id, yh.ad AS yemekhane, m.ogun_id, o.ad AS ogun,
           m.ogrenci_fiyati, m.personel_fiyati,
           d.kapasite, d.bos_yer, d.rezerve, d.doluluk_yuzde,
           p.oy_sayisi, p.ortalama_puan
      FROM menuler m
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      JOIN ogunler o ON o.id = m.ogun_id
      JOIN v_menu_doluluk d ON d.menu_id = m.id
      JOIN v_menu_puan p ON p.menu_id = m.id
     WHERE m.tarih BETWEEN ? AND DATE_ADD(?, INTERVAL 13 DAY)
     ORDER BY m.tarih, m.yemekhane_id, o.sira
  `, [startDate, startDate]);
  const foods = await getFoodsForMenus(menus.map((menu) => menu.id));
  return { menus, foods };
}

async function getFoods() {
  return db.read(`
    SELECT y.id, y.ad, y.kalori, y.vejetaryen, k.ad AS kategori,
           (SELECT GROUP_CONCAT(a.ad ORDER BY a.ad SEPARATOR ', ')
              FROM yemek_alerjenleri ya
              JOIN alerjenler a ON a.id = ya.alerjen_id
             WHERE ya.yemek_id = y.id) AS alerjenler
      FROM yemekler y
      JOIN yemek_kategorileri k ON k.id = y.kategori_id
     ORDER BY k.sira, y.ad
  `);
}

module.exports = {
  getCanteens,
  getMeals,
  getTodayComplete,
  getWeekly,
  createMenu,
  updateMenu,
  getAdminMenus,
  getFoods
};
