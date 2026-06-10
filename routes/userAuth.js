const db = require('../data/db');

const userAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token otentikasi tidak valid atau tidak disediakan' 
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token otentikasi tidak valid atau tidak disediakan' 
      });
    }

    const user = await db.get('SELECT id, name, email FROM users WHERE session_token = ?', [token]);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Sesi tidak ditemukan, tidak valid, atau kedaluwarsa' 
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = userAuthMiddleware;
