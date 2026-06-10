const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join('/app/storage', 'nedha.db');
const oldDbPath = path.join(__dirname, 'database.json');

const db = new Database(dbPath);

// Helper functions to query
const run = (sql, params = []) => {
  const stmt = db.prepare(sql);
  const info = stmt.run(params);
  return { id: info.lastInsertRowid, changes: info.changes };
};

const get = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.get(params);
};

const all = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.all(params);
};

// Helper function to migrate category text to categories JSON array
function migrateCategoryToCategories() {
  try {
    const rows = db.prepare(`SELECT id, category, categories FROM partners`).all();
    const titleCase = (c) => c.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    
    const stmt = db.prepare(`UPDATE partners SET categories = ? WHERE id = ?`);
    rows.forEach(row => {
      if (!row.categories) {
        let catsArr = [];
        if (row.category) {
          catsArr = Array.from(new Set(
            row.category
              .split(',')
              .map(titleCase)
              .filter(c => c.length > 0)
          ));
        }
        const catsJson = JSON.stringify(catsArr);
        stmt.run(catsJson, row.id);
        console.log(`Berhasil migrasi categories untuk partner ID ${row.id}: ${catsJson}`);
      }
    });
  } catch (err) {
    console.error('Gagal melakukan migrasi categories:', err);
  }
}

// Initialize DB schema and run migration if needed
function initDb() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      logo TEXT,
      category TEXT,
      categories TEXT,
      rating REAL DEFAULT 4.5
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image TEXT,
      calories INTEGER DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      session_token TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_price REAL NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_id TEXT NOT NULL,
      menu_name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      calories INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      menu_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      reviewer_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (menu_id) REFERENCES menu_items(id),
      UNIQUE(user_id, menu_id)
    );
  `);

  // PRAGMA column check for existing databases
  try {
    const columns = db.prepare(`PRAGMA table_info(partners)`).all();
    const hasCategories = columns.some(col => col.name === 'categories');
    if (!hasCategories) {
      console.log('Kolom categories tidak ditemukan di tabel partners. Melakukan ALTER TABLE...');
      db.exec(`ALTER TABLE partners ADD COLUMN categories TEXT`);
      console.log('Kolom categories berhasil ditambahkan ke tabel partners.');
      migrateCategoryToCategories();
    } else {
      migrateCategoryToCategories();
    }
  } catch (err) {
    console.error('Gagal mengambil info tabel partners / ALTER TABLE:', err);
  }

  // Check if migration is needed from database.json
  if (fs.existsSync(oldDbPath)) {
    console.log('Menemukan data lama database.json. Memulai migrasi ke SQLite...');
    try {
      const raw = fs.readFileSync(oldDbPath, 'utf8');
      const oldData = JSON.parse(raw);

      // Migrate Analytics
      if (oldData.analytics) {
        const stmt = db.prepare(`INSERT OR REPLACE INTO analytics (key, value) VALUES (?, ?)`);
        for (const [key, val] of Object.entries(oldData.analytics)) {
          stmt.run(key, val);
        }
      }

      // Migrate Partners & Menu Items
      if (Array.isArray(oldData.partners)) {
        const stmtPartner = db.prepare(`
          INSERT OR IGNORE INTO partners (id, name, description, address, phone, logo, category, categories, rating) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const stmtMenu = db.prepare(`
          INSERT OR IGNORE INTO menu_items (id, partner_id, name, price, description, image, calories, protein, carbs, fat)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const partner of oldData.partners) {
          let catsArr = [];
          if (partner.category) {
            catsArr = partner.category
              .split(',')
              .map(c => c.trim())
              .filter(c => c.length > 0);
          }
          const categoriesJson = JSON.stringify(catsArr);

          stmtPartner.run(
            partner.id, partner.name, partner.description, partner.address, partner.phone, partner.logo, partner.category, categoriesJson, partner.rating
          );

          if (Array.isArray(partner.menu)) {
            for (const item of partner.menu) {
              stmtMenu.run(
                item.id, partner.id, item.name, item.price, item.description, item.image, item.calories, item.protein, item.carbs, item.fat
              );
            }
          }
        }
      }

      console.log('Migrasi ke SQLite berhasil diselesaikan.');
      // Rename database.json to database.json.bak so we don't migrate again
      fs.renameSync(oldDbPath, oldDbPath + '.bak');
      console.log(`Mengubah nama database.json menjadi database.json.bak`);
    } catch (err) {
      console.error('Gagal melakukan migrasi database:', err);
    }
  }
}

initDb();

module.exports = {
  db,
  run,
  get,
  all
};
