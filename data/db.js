const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'nedha.db');
const oldDbPath = path.join(__dirname, 'database.json');

const db = new sqlite3.Database(dbPath);

// Helper function to query
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Helper function to migrate category text to categories JSON array
function migrateCategoryToCategories() {
  db.all(`SELECT id, category, categories FROM partners`, [], (err, rows) => {
    if (err) {
      console.error('Gagal membaca data partners untuk migrasi:', err);
      return;
    }
    
    const titleCase = (c) => c.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    
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
        db.run(`UPDATE partners SET categories = ? WHERE id = ?`, [catsJson, row.id], (upErr) => {
          if (upErr) {
            console.error(`Gagal migrasi categories untuk partner ID ${row.id}:`, upErr);
          } else {
            console.log(`Berhasil migrasi categories untuk partner ID ${row.id}: ${catsJson}`);
          }
        });
      }
    });
  });
}

// Initialize DB schema and run migration if needed
function initDb() {
  db.serialize(() => {
    // Create tables
    db.run(`CREATE TABLE IF NOT EXISTS analytics (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      logo TEXT,
      category TEXT,
      categories TEXT,
      rating REAL DEFAULT 4.5
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS menu_items (
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
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      session_token TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_price REAL NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_id TEXT NOT NULL,
      menu_name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      calories INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
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
    )`);

    // PRAGMA column check for existing databases
    db.all(`PRAGMA table_info(partners)`, (err, columns) => {
      if (err) {
        console.error('Gagal mengambil info tabel partners:', err);
        return;
      }
      const hasCategories = columns.some(col => col.name === 'categories');
      if (!hasCategories) {
        console.log('Kolom categories tidak ditemukan di tabel partners. Melakukan ALTER TABLE...');
        db.run(`ALTER TABLE partners ADD COLUMN categories TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Gagal menambahkan kolom categories:', alterErr);
          } else {
            console.log('Kolom categories berhasil ditambahkan ke tabel partners.');
            migrateCategoryToCategories();
          }
        });
      } else {
        migrateCategoryToCategories();
      }
    });

    // Check if migration is needed from database.json
    if (fs.existsSync(oldDbPath)) {
      console.log('Menemukan data lama database.json. Memulai migrasi ke SQLite...');
      try {
        const raw = fs.readFileSync(oldDbPath, 'utf8');
        const oldData = JSON.parse(raw);

        // Migrate Analytics
        if (oldData.analytics) {
          for (const [key, val] of Object.entries(oldData.analytics)) {
            db.run(`INSERT OR REPLACE INTO analytics (key, value) VALUES (?, ?)`, [key, val]);
          }
        }

        // Migrate Partners & Menu Items
        if (Array.isArray(oldData.partners)) {
          for (const partner of oldData.partners) {
            let catsArr = [];
            if (partner.category) {
              catsArr = partner.category
                .split(',')
                .map(c => c.trim())
                .filter(c => c.length > 0);
            }
            const categoriesJson = JSON.stringify(catsArr);

            db.run(`INSERT OR IGNORE INTO partners (id, name, description, address, phone, logo, category, categories, rating) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
              [partner.id, partner.name, partner.description, partner.address, partner.phone, partner.logo, partner.category, categoriesJson, partner.rating]
            );

            if (Array.isArray(partner.menu)) {
              for (const item of partner.menu) {
                db.run(`INSERT OR IGNORE INTO menu_items (id, partner_id, name, price, description, image, calories, protein, carbs, fat)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [item.id, partner.id, item.name, item.price, item.description, item.image, item.calories, item.protein, item.carbs, item.fat]
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
  });
}

initDb();

module.exports = {
  db,
  run,
  get,
  all
};
