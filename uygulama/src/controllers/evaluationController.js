const repository = require('../repositories/evaluationRepository');

async function usedMenus(req, res, next) {
  try {
    res.json(await repository.getUsedMenus(req.session.userId));
  } catch (error) {
    next(error);
  }
}

async function save(req, res, next) {
  try {
    const rating = Number(req.body.puan);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Puan 1 ile 5 arasında olmalıdır.' });
    }
    await repository.saveEvaluation(
      req.session.userId,
      Number(req.body.menu_id),
      rating,
      String(req.body.yorum || '')
    );
    res.status(201).json({ message: 'Değerlendirmeniz kaydedildi.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { usedMenus, save };
