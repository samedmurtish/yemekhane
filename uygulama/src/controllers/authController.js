const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const { createSession } = require('../middleware');
const redisService = require('../services/redisService');

async function login(req, res, next) {
  try {
    const email = String(req.body.eposta || '').trim();
    const password = String(req.body.sifre || '');
    const user = await userRepository.findByEmail(email);
    if (!user || !user.aktif || !(await bcrypt.compare(password, user.sifre_hash))) {
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
    }
    const token = createSession(user);
    await redisService.createSession(token, {
      userId: user.id,
      rol: user.rol,
      ad: user.ad,
      soyad: user.soyad,
      eposta: user.eposta
    });
    res.setHeader('Set-Cookie', `oturum=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=1800`);
    return res.json({
      id: user.id,
      ad: user.ad,
      soyad: user.soyad,
      eposta: user.eposta,
      rol: user.rol
    });
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  return res.json(req.session);
}

async function logout(req, res, next) {
  try {
    if (req.sessionToken) await redisService.deleteSession(req.sessionToken);
  } catch (error) {
    return next(error);
  }
  res.setHeader('Set-Cookie', 'oturum=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  return res.json({ message: 'Çıkış yapıldı.' });
}

module.exports = { login, me, logout };
