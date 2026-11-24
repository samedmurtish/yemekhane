const repository = require('../repositories/profileRepository');

async function allergens(req, res, next) {
  try {
    res.json(await repository.getAllergens(req.session.userId));
  } catch (error) {
    next(error);
  }
}

async function saveAllergens(req, res, next) {
  try {
    const ids = Array.isArray(req.body.alerjen_ids)
      ? [...new Set(req.body.alerjen_ids.map(Number).filter((id) => id > 0))]
      : [];
    await repository.saveAllergens(req.session.userId, ids);
    res.json({ message: 'Alerjenler kaydedildi.', selectedIds: ids });
  } catch (error) {
    next(error);
  }
}

module.exports = { allergens, saveAllergens };
