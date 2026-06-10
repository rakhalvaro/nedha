const express = require('express');
const router = express.Router();
const path = require('path');
const authMiddleware = require('./auth');

// Route for Landing Page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

// Route for Admin Panel (Protected)
router.get('/admin', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'admin.html'));
});

// Route for Login Page
router.get('/login', (req, res) => {
  const sessionToken = req.cookies && req.cookies.nedha_session;
  if (sessionToken === 'nedha_admin_authorized') {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
});

// Process Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'nedha123';

  if (username === adminUser && password === adminPass) {
    // Set cookie valid for 1 day
    res.cookie('nedha_session', 'nedha_admin_authorized', {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });
    return res.redirect('/admin');
  }

  // Redirect to login page with error query parameter
  res.redirect('/login?error=credentials');
});

// Process Logout
router.get('/logout', (req, res) => {
  res.clearCookie('nedha_session', { path: '/' });
  res.redirect('/login');
});

module.exports = router;
