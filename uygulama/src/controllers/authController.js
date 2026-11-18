const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const { createSession, destroySession } = require('../middleware');

async function login(req, res, next) {
  try {
    const email = String(req.body.eposta || '').trim();
    const password = String(req.body.sifre || '');
    const user = await userRepository.findByEmail(email);
    if (!user || !user.aktif || !(await bcrypt.compare(password, user.sifre_hash))) {
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
    }
    const token = createSession(user);
    res.setHeader('Set-Cookie', `oturum=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
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

function logout(req, res) {
  if (req.sessionToken) destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', 'oturum=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  return res.json({ message: 'Çıkış yapıldı.' });
}

module.exports = { login, me, logout };
