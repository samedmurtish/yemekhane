const repository = require('../repositories/reservationRepository');
const userRepository = require('../repositories/userRepository');

async function list(req, res, next) {
  try {
    res.json(await repository.getReservations(req.session.userId));
  } catch (error) {
    next(error);
  }
}

async function reserve(req, res, next) {
  try {
    const result = await repository.reserve(req.session.userId, Number(req.body.menu_id));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    res.json(await repository.cancel(req.session.userId, Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

async function balance(req, res, next) {
  try {
    const balance = await userRepository.getBalance(req.session.userId);
    const history = await userRepository.getHistory(req.session.userId);
    res.json({ balance: balance?.bakiye || '0.00', history });
  } catch (error) {
    next(error);
  }
}

async function loadBalance(req, res, next) {
  try {
    const result = await repository.loadBalance(req.session.userId, Number(req.body.tutar));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { list, reserve, cancel, balance, loadBalance };
