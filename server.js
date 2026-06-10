const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend frameworks / Flutter mobile app integration
app.use(cors());

// Parse requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Parse cookies kustom middleware
app.use((req, res, next) => {
  const cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const name = parts.shift().trim();
      const val = parts.join('=');
      cookies[name] = decodeURIComponent(val);
    });
  }
  req.cookies = cookies;
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure public directories exist
const publicDirs = [
  path.join(__dirname, 'public', 'css'),
  path.join(__dirname, 'public', 'js'),
  path.join(__dirname, 'public', 'images'),
  path.join(__dirname, 'public', 'downloads')
];
publicDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Import Routers
const webRouter = require('./routes/web');
const apiRouter = require('./routes/api');

// Mount Routers
app.use('/api/v1', apiRouter);
app.use('/', webRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal pada server'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Nedha Web Platform Server berjalan di port ${PORT}`);
  console.log(`Akses Landing Page: http://localhost:${PORT}`);
  console.log(`Akses Admin Panel:  http://localhost:${PORT}/admin`);
  console.log(`===================================================`);
});
