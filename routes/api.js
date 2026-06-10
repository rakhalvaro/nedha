const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../data/db');
const authMiddleware = require('./auth');
const userAuthMiddleware = require('./userAuth');

// Setup Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'images');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya diperbolehkan mengupload file gambar (jpeg, jpg, png, gif, webp)!'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // limit 5MB
});

// Image Upload Endpoint (Admin, auth protected)
router.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah' });
  }
  const filePath = `/images/${req.file.filename}`;
  res.json({ success: true, url: filePath });
});

// Get all partners (for Flutter & Landing Page)
router.get('/partners', async (req, res, next) => {
  try {
    const partners = await db.all('SELECT * FROM partners');
    const menuItems = await db.all('SELECT * FROM menu_items');
    
    // Map menu items to their partners
    partners.forEach(partner => {
      partner.menu = menuItems.filter(item => item.partner_id === partner.id);
      try {
        partner.categories = JSON.parse(partner.categories || '[]');
      } catch (e) {
        partner.categories = [];
      }
    });
    
    res.json(partners);
  } catch (err) {
    next(err);
  }
});

// Get partner by ID (for Flutter & Admin Detail)
router.get('/partners/:id', async (req, res, next) => {
  try {
    const partner = await db.get('SELECT * FROM partners WHERE id = ?', [req.params.id]);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
    }
    partner.menu = await db.all('SELECT * FROM menu_items WHERE partner_id = ?', [partner.id]);
    try {
      partner.categories = JSON.parse(partner.categories || '[]');
    } catch (e) {
      partner.categories = [];
    }
    res.json(partner);
  } catch (err) {
    next(err);
  }
});

// Get all unique categories from all partners
router.get('/categories', async (req, res, next) => {
  try {
    const partners = await db.all('SELECT categories FROM partners');
    const uniqueCats = new Set();
    partners.forEach(p => {
      if (p.categories) {
        try {
          const cats = JSON.parse(p.categories);
          if (Array.isArray(cats)) {
            cats.forEach(c => {
              if (c) {
                // Normalize to Title Case (e.g. "low carb" -> "Low Carb")
                const normalized = c.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                uniqueCats.add(normalized);
              }
            });
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    });
    const sortedCategories = Array.from(uniqueCats).sort((a, b) => a.localeCompare(b, 'id'));
    res.json(sortedCategories);
  } catch (err) {
    next(err);
  }
});

// Create new partner (Admin Panel, auth protected)
router.post('/partners', authMiddleware, async (req, res, next) => {
  try {
    const { name, description, address, phone, logo, category, categories } = req.body;
    if (!name || !description) {
      return res.status(400).json({ success: false, message: 'Nama dan deskripsi wajib diisi' });
    }

    const titleCase = (c) => c.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const uniqueArray = (arr) => Array.from(new Set(arr));

    let finalCategories = [];
    let finalCategory = '';

    if (Array.isArray(categories)) {
      finalCategories = uniqueArray(categories.map(titleCase).filter(Boolean));
      finalCategory = finalCategories.join(', ');
    } else if (typeof category === 'string') {
      finalCategories = uniqueArray(category.split(',').map(titleCase).filter(Boolean));
      finalCategory = finalCategories.join(', ');
    } else if (typeof category === 'object' && category !== null) {
      finalCategories = uniqueArray((Array.isArray(category) ? category : []).map(titleCase).filter(Boolean));
      finalCategory = finalCategories.join(', ');
    } else {
      finalCategory = 'General Healthy';
      finalCategories = ['General Healthy'];
    }

    const categoriesJson = JSON.stringify(finalCategories);

    const newPartner = {
      id: String(Date.now()),
      name,
      description,
      address: address || '',
      phone: phone || '',
      logo: logo || '/images/default-partner.jpg',
      category: finalCategory,
      categories: finalCategories,
      rating: parseFloat((4.0 + Math.random() * 1.0).toFixed(1)), // rating awal random 4.0 - 5.0
      menu: []
    };

    await db.run(
      `INSERT INTO partners (id, name, description, address, phone, logo, category, categories, rating) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newPartner.id, newPartner.name, newPartner.description, newPartner.address, newPartner.phone, newPartner.logo, newPartner.category, categoriesJson, newPartner.rating]
    );

    res.status(201).json({ success: true, partner: newPartner });
  } catch (err) {
    next(err);
  }
});

// Update partner (Admin Panel, auth protected)
router.put('/partners/:id', authMiddleware, async (req, res, next) => {
  try {
    const { name, description, address, phone, logo, category, categories } = req.body;
    const partner = await db.get('SELECT * FROM partners WHERE id = ?', [req.params.id]);

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
    }

    const titleCase = (c) => c.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const uniqueArray = (arr) => Array.from(new Set(arr));

    let finalCategories = null;
    let finalCategory = null;

    if (categories !== undefined) {
      if (Array.isArray(categories)) {
        finalCategories = uniqueArray(categories.map(titleCase).filter(Boolean));
        finalCategory = finalCategories.join(', ');
      }
    } else if (category !== undefined) {
      if (typeof category === 'string') {
        finalCategories = uniqueArray(category.split(',').map(titleCase).filter(Boolean));
        finalCategory = finalCategories.join(', ');
      } else if (Array.isArray(category)) {
        finalCategories = uniqueArray(category.map(titleCase).filter(Boolean));
        finalCategory = finalCategories.join(', ');
      }
    }

    const updated = {
      name: name || partner.name,
      description: description || partner.description,
      address: address !== undefined ? address : partner.address,
      phone: phone !== undefined ? phone : partner.phone,
      logo: logo || partner.logo,
      category: finalCategory !== null ? finalCategory : partner.category,
      categories: finalCategories !== null ? JSON.stringify(finalCategories) : partner.categories
    };

    await db.run(
      `UPDATE partners SET name = ?, description = ?, address = ?, phone = ?, logo = ?, category = ?, categories = ? 
       WHERE id = ?`,
      [updated.name, updated.description, updated.address, updated.phone, updated.logo, updated.category, updated.categories, req.params.id]
    );

    let responseCategories = [];
    try {
      responseCategories = JSON.parse(updated.categories || '[]');
    } catch (e) {
      responseCategories = [];
    }

    res.json({ 
      success: true, 
      partner: { 
        ...partner, 
        ...updated, 
        categories: responseCategories 
      } 
    });
  } catch (err) {
    next(err);
  }
});

// Delete partner (Admin Panel, auth protected)
router.delete('/partners/:id', authMiddleware, async (req, res, next) => {
  try {
    const partner = await db.get('SELECT * FROM partners WHERE id = ?', [req.params.id]);

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
    }

    // Explicitly delete menu items to avoid dependency issues if PRAGMA isn't initialized yet
    await db.run('DELETE FROM menu_items WHERE partner_id = ?', [req.params.id]);
    await db.run('DELETE FROM partners WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Mitra berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});

// Add menu item to partner (Admin Panel, auth protected)
router.post('/partners/:partnerId/menu', authMiddleware, async (req, res, next) => {
  try {
    const { name, price, description, image, calories, protein, carbs, fat } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Nama menu dan harga wajib diisi' });
    }

    const partner = await db.get('SELECT * FROM partners WHERE id = ?', [req.params.partnerId]);

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
    }

    const newMenuItem = {
      id: String(Date.now() + 1),
      name,
      price: Number(price),
      description: description || '',
      image: image || '/images/default-food.jpg',
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0
    };

    await db.run(
      `INSERT INTO menu_items (id, partner_id, name, price, description, image, calories, protein, carbs, fat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newMenuItem.id, req.params.partnerId, newMenuItem.name, newMenuItem.price, newMenuItem.description, newMenuItem.image, newMenuItem.calories, newMenuItem.protein, newMenuItem.carbs, newMenuItem.fat]
    );

    res.status(201).json({ success: true, menu: newMenuItem });
  } catch (err) {
    next(err);
  }
});

// Delete menu item from partner (Admin Panel, auth protected)
router.delete('/partners/:partnerId/menu/:menuId', authMiddleware, async (req, res, next) => {
  try {
    const menu = await db.get('SELECT * FROM menu_items WHERE id = ? AND partner_id = ?', [req.params.menuId, req.params.partnerId]);

    if (!menu) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
    }

    await db.run('DELETE FROM menu_items WHERE id = ?', [req.params.menuId]);
    res.json({ success: true, message: 'Menu berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});

// Increment Download Counter (Landing Page download click)
router.post('/analytics/download', async (req, res, next) => {
  try {
    await db.run(`INSERT INTO analytics (key, value) VALUES ('downloads', 1) 
                  ON CONFLICT(key) DO UPDATE SET value = value + 1`);
    const row = await db.get(`SELECT value FROM analytics WHERE key = 'downloads'`);
    res.json({ success: true, downloads: row ? row.value : 1 });
  } catch (err) {
    next(err);
  }
});

// Increment Page View (invoked when Landing Page loads)
router.post('/analytics/view', async (req, res, next) => {
  try {
    await db.run(`INSERT INTO analytics (key, value) VALUES ('pageViews', 1) 
                  ON CONFLICT(key) DO UPDATE SET value = value + 1`);
    const row = await db.get(`SELECT value FROM analytics WHERE key = 'pageViews'`);
    res.json({ success: true, pageViews: row ? row.value : 1 });
  } catch (err) {
    next(err);
  }
});

// Get Analytics (Admin Panel Dashboard)
router.get('/analytics', async (req, res, next) => {
  try {
    const rows = await db.all(`SELECT * FROM analytics`);
    const analytics = {};
    rows.forEach(r => {
      analytics[r.key] = r.value;
    });

    const partnersCountRow = await db.get(`SELECT COUNT(*) as count FROM partners`);
    const usersCountRow = await db.get(`SELECT COUNT(*) as count FROM users`);

    res.json({
      downloads: analytics.downloads || 0,
      pageViews: analytics.pageViews || 0,
      partnersCount: partnersCountRow ? partnersCountRow.count : 0,
      usersCount: usersCountRow ? usersCountRow.count : 0
    });
  } catch (err) {
    next(err);
  }
});

// User Registration Endpoint
router.post('/users/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'name, email, dan password wajib diisi' 
      });
    }

    // Check if email already exists
    const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email sudah digunakan' 
      });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save to database
    const id = String(Date.now());
    await db.run(
      `INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`,
      [id, name, email, passwordHash]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Registrasi berhasil' 
    });
  } catch (err) {
    next(err);
  }
});

// User Login Endpoint
router.post('/users/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'email dan password wajib diisi' 
      });
    }

    // Find user
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email atau password salah' 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email atau password salah' 
      });
    }

    // Generate random 32-byte hex token
    const token = crypto.randomBytes(32).toString('hex');

    // Save token to session_token column
    await db.run('UPDATE users SET session_token = ? WHERE id = ?', [token, user.id]);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get All Users Endpoint (Admin only)
router.get('/users', authMiddleware, async (req, res, next) => {
  try {
    const users = await db.all('SELECT id, name, email, created_at FROM users');
    res.json({
      success: true,
      users,
      total: users.length
    });
  } catch (err) {
    next(err);
  }
});

// Create new order (Requires user auth)
router.post('/orders', userAuthMiddleware, async (req, res, next) => {
  try {
    const { partner_id, partner_name, items, total_price, note } = req.body;

    // Validation
    if (!partner_id || !partner_name || !items || !Array.isArray(items) || items.length === 0 || total_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'partner_id, partner_name, items (non-empty array), dan total_price wajib diisi'
      });
    }

    const orderId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();

    // Insert order (hardcoded status 'success')
    await db.run(
      `INSERT INTO orders (id, user_id, partner_id, partner_name, status, total_price, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, req.user.id, partner_id, partner_name, 'pending', Number(total_price), note || '', createdAt]
    );

    // Insert order items
    for (const item of items) {
      const itemId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      await db.run(
        `INSERT INTO order_items (id, order_id, menu_id, menu_name, price, qty, calories)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, orderId, item.menu_id, item.menu_name, Number(item.price), Number(item.qty), Number(item.calories) || 0]
      );
    }

    res.status(201).json({
      success: true,
      order: {
        id: orderId,
        status: 'pending',
        created_at: createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get all orders for the authenticated user (Requires user auth)
router.get('/orders', userAuthMiddleware, async (req, res, next) => {
  try {
    const orders = await db.all(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Fetch items for each order
    for (const order of orders) {
      order.items = await db.all(
        `SELECT id, menu_id, menu_name, price, qty, calories FROM order_items WHERE order_id = ?`,
        [order.id]
      );
    }

    res.json({
      success: true,
      orders
    });
  } catch (err) {
    next(err);
  }
});

// Get detailed single order (Requires user auth)
router.get('/orders/:id', userAuthMiddleware, async (req, res, next) => {
  try {
    const order = await db.get(
      `SELECT * FROM orders WHERE id = ?`,
      [req.params.id]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan'
      });
    }

    // Ownership check: Ensure this order belongs to the authenticated user
    if (order.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke pesanan ini'
      });
    }

    // Get order items
    order.items = await db.all(
      `SELECT id, menu_id, menu_name, price, qty, calories FROM order_items WHERE order_id = ?`,
      [order.id]
    );

    res.json({
      success: true,
      order
    });
  } catch (err) {
    next(err);
  }
});

// Submit review (Requires user auth)
router.post('/reviews', userAuthMiddleware, async (req, res, next) => {
  try {
    const { menu_id, order_item_id, rating, comment } = req.body;

    // Validation
    if (!menu_id || !order_item_id || rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'menu_id, order_item_id, dan rating (1-5) wajib diisi'
      });
    }

    // Check if order_item_id belongs to the logged-in user and corresponds to the menu_id
    const orderItem = await db.get(
      `SELECT oi.id FROM order_items oi 
       JOIN orders o ON oi.order_id = o.id 
       WHERE oi.id = ? AND o.user_id = ? AND oi.menu_id = ?`,
      [order_item_id, req.user.id, menu_id]
    );

    if (!orderItem) {
      return res.status(400).json({
        success: false,
        message: 'Item pesanan tidak ditemukan atau bukan milik Anda'
      });
    }

    // Check duplicate review by same user for same menu
    const existingReview = await db.get(
      `SELECT id FROM reviews WHERE user_id = ? AND menu_id = ?`,
      [req.user.id, menu_id]
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah me-review menu ini sebelumnya'
      });
    }

    const reviewId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();

    // Insert review
    await db.run(
      `INSERT INTO reviews (id, user_id, menu_id, order_item_id, rating, comment, reviewer_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reviewId, req.user.id, menu_id, order_item_id, rating, comment || '', req.user.name, createdAt]
    );

    // Recalculate average rating of all menus for the partner and update partners table
    const menuItem = await db.get(`SELECT partner_id FROM menu_items WHERE id = ?`, [menu_id]);
    if (menuItem) {
      const partnerId = menuItem.partner_id;
      const avgResult = await db.get(
        `SELECT AVG(r.rating) as avg_rating FROM reviews r 
         JOIN menu_items mi ON r.menu_id = mi.id 
         WHERE mi.partner_id = ?`,
        [partnerId]
      );
      if (avgResult && avgResult.avg_rating !== null) {
        const newRating = parseFloat(Number(avgResult.avg_rating).toFixed(1));
        await db.run(`UPDATE partners SET rating = ? WHERE id = ?`, [newRating, partnerId]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Review berhasil disimpan'
    });
  } catch (err) {
    next(err);
  }
});

// Get all reviews for a menu item (public, no auth required)
router.get('/reviews/menu/:menuId', async (req, res, next) => {
  try {
    const reviews = await db.all(
      `SELECT id, rating, comment, reviewer_name, created_at 
       FROM reviews 
       WHERE menu_id = ? 
       ORDER BY created_at DESC`,
      [req.params.menuId]
    );

    let totalReviews = reviews.length;
    let avgRating = 0;

    if (totalReviews > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      avgRating = parseFloat((sum / totalReviews).toFixed(1));
    }

    res.json({
      success: true,
      reviews,
      summary: {
        average_rating: avgRating,
        total_reviews: totalReviews
      }
    });
  } catch (err) {
    next(err);
  }
});

// Check if user has already reviewed a menu (Requires user auth)
router.get('/reviews/check', userAuthMiddleware, async (req, res, next) => {
  try {
    const menuId = req.query.menu_id;
    if (!menuId) {
      return res.status(400).json({
        success: false,
        message: 'menu_id wajib disediakan'
      });
    }

    const review = await db.get(
      `SELECT id, rating, comment, reviewer_name, created_at 
       FROM reviews 
       WHERE user_id = ? AND menu_id = ?`,
      [req.user.id, menuId]
    );

    res.json({
      success: true,
      reviewed: !!review,
      review: review || null
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/orders - list all orders
router.get('/admin/orders', authMiddleware, async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.*, u.name as user_name 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id
    `;
    const params = [];
    if (status) {
      query += ` WHERE o.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY o.created_at DESC`;

    const orders = await db.all(query, params);

    // Fetch order items for each order
    for (const order of orders) {
      order.items = await db.all(
        `SELECT id, menu_id, menu_name, price, qty, calories FROM order_items WHERE order_id = ?`,
        [order.id]
      );
    }

    res.json({
      success: true,
      orders
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/orders/stats - order statistics
router.get('/admin/orders/stats', authMiddleware, async (req, res, next) => {
  try {
    const totalOrdersRow = await db.get("SELECT COUNT(*) as count FROM orders");
    const totalRevenueRow = await db.get("SELECT SUM(total_price) as sum FROM orders WHERE status != 'cancelled'");
    const todayOrdersRow = await db.get("SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')");
    
    const statusBreakdownRows = await db.all("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
    
    const topMenus = await db.all(`
      SELECT oi.menu_id, oi.menu_name, SUM(oi.qty) as total_qty 
      FROM order_items oi 
      JOIN orders o ON oi.order_id = o.id 
      WHERE o.status != 'cancelled'
      GROUP BY oi.menu_id, oi.menu_name 
      ORDER BY total_qty DESC 
      LIMIT 5
    `);

    const topPartners = await db.all(`
      SELECT partner_id, partner_name, COUNT(*) as total_orders 
      FROM orders 
      GROUP BY partner_id, partner_name 
      ORDER BY total_orders DESC 
      LIMIT 5
    `);

    const total_orders = totalOrdersRow ? totalOrdersRow.count : 0;
    const total_revenue = totalRevenueRow && totalRevenueRow.sum !== null ? totalRevenueRow.sum : 0;
    const today_orders = todayOrdersRow ? todayOrdersRow.count : 0;

    const status_breakdown = {
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0
    };
    statusBreakdownRows.forEach(row => {
      status_breakdown[row.status] = row.count;
    });

    res.json({
      success: true,
      stats: {
        total_orders,
        total_revenue,
        today_orders,
        status_breakdown,
        top_menus: topMenus,
        top_partners: topPartners
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/orders/:id/status - update order status
router.patch('/admin/orders/:id/status', authMiddleware, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status wajib diisi' });
    }

    // Check if order exists
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    }

    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);

    res.json({
      success: true,
      message: 'Status pesanan berhasil diperbarui',
      status
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
