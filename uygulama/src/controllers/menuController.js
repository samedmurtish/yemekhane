const menuRepository = require('../repositories/menuRepository');

async function canteens(req, res, next) {
  try {
    res.json(await menuRepository.getCanteens());
  } catch (error) {
    next(error);
  }
}

async function meals(req, res, next) {
  try {
    res.json(await menuRepository.getMeals());
  } catch (error) {
    next(error);
  }
}

async function today(req, res, next) {
  try {
    const canteenId = Number(req.query.yemekhane_id || 1);
    res.json(await menuRepository.getTodayComplete(canteenId));
  } catch (error) {
    next(error);
  }
}

async function weekly(req, res, next) {
  try {
    const canteenId = Number(req.query.yemekhane_id || 1);
    const startDate = String(req.query.baslangic || new Date().toISOString().slice(0, 10));
    res.json(await menuRepository.getWeekly(canteenId, startDate));
  } catch (error) {
    next(error);
  }
}

async function foods(req, res, next) {
  try {
    res.json(await menuRepository.getFoods());
  } catch (error) {
    next(error);
  }
}

async function adminMenus(req, res, next) {
  try {
    const startDate = String(req.query.baslangic || new Date().toISOString().slice(0, 10));
    res.json(await menuRepository.getAdminMenus(startDate));
  } catch (error) {
    next(error);
  }
}

async function createMenu(req, res, next) {
  try {
    const id = await menuRepository.createMenu({
      yemekhaneId: Number(req.body.yemekhane_id),
      tarih: req.body.tarih,
      ogunId: Number(req.body.ogun_id),
      ogrenciFiyati: Number(req.body.ogrenci_fiyati),
      personelFiyati: Number(req.body.personel_fiyati),
      yemekIds: Array.isArray(req.body.yemek_ids) ? req.body.yemek_ids.map(Number) : []
    });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
}

async function updateMenu(req, res, next) {
  try {
    await menuRepository.updateMenu(Number(req.params.id), {
      ogrenciFiyati: Number(req.body.ogrenci_fiyati),
      personelFiyati: Number(req.body.personel_fiyati),
      yemekIds: Array.isArray(req.body.yemek_ids) ? req.body.yemek_ids.map(Number) : []
    });
    res.json({ message: 'Menü güncellendi.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { canteens, meals, today, weekly, foods, adminMenus, createMenu, updateMenu };
