const express = require('express');
const authController = require('./controllers/authController');
const menuController = require('./controllers/menuController');
const reservationController = require('./controllers/reservationController');
const evaluationController = require('./controllers/evaluationController');
const { requireAuth, requireAdmin } = require('./middleware');

const router = express.Router();

router.post('/api/auth/login', authController.login);
router.post('/api/auth/logout', requireAuth, authController.logout);
router.get('/api/auth/me', requireAuth, authController.me);

router.get('/api/canteens', menuController.canteens);
router.get('/api/meals', menuController.meals);
router.get('/api/menu/today', menuController.today);
router.get('/api/menu/weekly', menuController.weekly);
router.get('/api/foods', requireAuth, requireAdmin, menuController.foods);

router.get('/api/reservations', requireAuth, reservationController.list);
router.post('/api/reservations', requireAuth, reservationController.reserve);
router.post('/api/reservations/:id/cancel', requireAuth, reservationController.cancel);
router.get('/api/balance', requireAuth, reservationController.balance);
router.get('/api/balance/source', requireAuth, reservationController.sourceBalance);
router.post('/api/balance/load', requireAuth, reservationController.loadBalance);

router.get('/api/evaluations/used-menus', requireAuth, evaluationController.usedMenus);
router.post('/api/evaluations', requireAuth, evaluationController.save);

router.get('/api/admin/menus', requireAuth, requireAdmin, menuController.adminMenus);
router.post('/api/admin/menus', requireAuth, requireAdmin, menuController.createMenu);
router.put('/api/admin/menus/:id', requireAuth, requireAdmin, menuController.updateMenu);

router.get('/api/health', (req, res) => res.json({ status: 'ok' }));

module.exports = router;
