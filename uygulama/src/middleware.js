const crypto = require('crypto');
const sessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, rol: user.rol, ad: user.ad, soyad: user.soyad, eposta: user.eposta });
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function sessionMiddleware(req, res, next) {
  const cookieToken = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('oturum='))
    ?.split('=')[1];
  if (cookieToken && sessions.has(cookieToken)) {
    req.session = sessions.get(cookieToken);
    req.sessionToken = cookieToken;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ message: 'Giriş yapmanız gerekiyor.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.rol !== 'yonetici') {
    return res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekiyor.' });
  }
  next();
}

function errorHandler(error, req, res, next) {
  if (error && error.sqlState === '45000') {
    return res.status(400).json({ message: error.sqlMessage || error.message });
  }
  if (error && error.errno === 3819) {
    return res.status(500).json({ message: 'Veri kısıtı ihlal edildi.' });
  }
  console.error(error);
  return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
}

module.exports = {
  createSession,
  destroySession,
  sessionMiddleware,
  requireAuth,
  requireAdmin,
  errorHandler
};
