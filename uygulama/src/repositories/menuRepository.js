const db = require('../db');
const redisService = require('../services/redisService');

function turkeyToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

async function getCachedMenu(canteenId, date, mealId) {
  const key = redisService.menuKey(canteenId, date, mealId);
  const cached = await redisService.getMenu(key);
  if (cached) {
    console.log(`[CACHE HIT] ${key} -> served from redis`);
    return cached;
  }

  const menus = await db.read(`
    SELECT m.id, m.tarih, m.ogun_id, o.ad AS ogun, m.ogrenci_fiyati,
           m.personel_fiyati, d.kapasite, d.bos_yer, d.rezerve,
           d.rezervasyon_son
      FROM menuler m
      JOIN ogunler o ON o.id = m.ogun_id
      JOIN v_menu_doluluk d ON d.menu_id = m.id
     WHERE m.yemekhane_id = ? AND m.tarih = ? AND m.ogun_id = ?
  `, [canteenId, date, mealId]);
  if (!menus.length) {
    await redisService.setMenu(key, { menu: null, foods: [] });
    console.log(`[CACHE MISS] ${key} -> fetched from mysql-replica`);
    return { menu: null, foods: [] };
  }

  const menu = menus[0];
  const foods = await getFoodsForMenus([menu.id]);
  const payload = { menu, foods };
  await redisService.setMenu(key, payload);
  console.log(`[CACHE MISS] ${key} -> fetched from mysql-replica`);
  return payload;
}

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
             vd.alerjenler, vd.alerjen_idler, vd.kategori, vd.kategori_sira
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
           vd.alerjenler, vd.alerjen_idler, vd.kategori, vd.kategori_sira
      FROM v_menu_detay vd
     WHERE vd.menu_id IN (${placeholders})
     ORDER BY vd.ogun_sira, vd.kategori_sira, vd.yemek
  `, menuIds);
}

async function getTodayComplete(canteenId) {
  const date = turkeyToday();
  const payloads = await Promise.all([1, 2, 3].map((mealId) =>
    getCachedMenu(canteenId, date, mealId)
  ));
  const menus = payloads.map((payload) => payload.menu).filter(Boolean);
  const foods = payloads.flatMap((payload) => payload.foods);
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
  const cachedPayloads = await Promise.all(
    menus.map((menu) => getCachedMenu(
      canteenId,
      new Date(menu.tarih).toISOString().slice(0, 10),
      menu.ogun_id
    ))
  );
  const foods = cachedPayloads.flatMap((payload) => payload.foods);
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
    await redisService.invalidateMenu(
      redisService.menuKey(yemekhaneId, tarih, ogunId)
    );
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
    const [metadataRows] = await connection.execute(
      'SELECT yemekhane_id, DATE_FORMAT(tarih, "%Y-%m-%d") AS tarih, ogun_id FROM menuler WHERE id = ?',
      [menuId]
    );
    if (!metadataRows.length) {
      throw new Error('Menü bulunamadı.');
    }
    const metadata = metadataRows[0];
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
    await redisService.invalidateMenu(
      redisService.menuKey(metadata.yemekhane_id, metadata.tarih, metadata.ogun_id)
    );
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
