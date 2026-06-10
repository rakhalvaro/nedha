const authMiddleware = (req, res, next) => {
  const sessionToken = req.cookies && req.cookies.nedha_session;
  const expectedToken = 'nedha_admin_authorized';

  if (sessionToken === expectedToken) {
    return next();
  }

  // Check if it's an API request or expects JSON
  const isApi = req.originalUrl.startsWith('/api') || 
                (req.headers.accept && req.headers.accept.includes('application/json'));

  if (isApi) {
    return res.status(401).json({ 
      success: false, 
      message: 'Sesi Anda telah berakhir atau belum terautentikasi. Silakan login kembali.' 
    });
  }

  // Redirect web request to login page
  res.redirect('/login');
};

module.exports = authMiddleware;
