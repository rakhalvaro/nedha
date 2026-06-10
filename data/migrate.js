const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'nedha.db');
const backupPath = path.join(__dirname, 'database.json.bak');

if (!fs.existsSync(backupPath)) {
  console.log('Tidak ada database.json.bak untuk dimigrasikan.');
  process.exit(0);
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Ensure tables exist
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

  // Read backup
  const raw = fs.readFileSync(backupPath, 'utf8');
  const backupData = JSON.parse(raw);

  // Migrate Analytics
  if (backupData.analytics) {
    for (const [key, val] of Object.entries(backupData.analytics)) {
      db.run(`INSERT OR REPLACE INTO analytics (key, value) VALUES (?, ?)`, [key, val], (err) => {
        if (err) console.error(`Error migrating analytic ${key}:`, err);
      });
    }
  }

  // Migrate Partners
  if (Array.isArray(backupData.partners)) {
    const titleCase = (c) => c.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    for (const partner of backupData.partners) {
      let catsArr = [];
      if (partner.category) {
        catsArr = Array.from(new Set(
          partner.category
            .split(',')
            .map(titleCase)
            .filter(c => c.length > 0)
        ));
      }
      const categoriesJson = JSON.stringify(catsArr);

      db.run(`INSERT OR REPLACE INTO partners (id, name, description, address, phone, logo, category, categories, rating) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [partner.id, partner.name, partner.description, partner.address, partner.phone, partner.logo, partner.category, categoriesJson, partner.rating],
        (err) => {
          if (err) console.error(`Error migrating partner ${partner.name}:`, err);
          else {
            console.log(`Migrated partner: ${partner.name}`);
            // Migrate Menu Items
            if (Array.isArray(partner.menu)) {
              for (const item of partner.menu) {
                db.run(`INSERT OR REPLACE INTO menu_items (id, partner_id, name, price, description, image, calories, protein, carbs, fat)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [item.id, partner.id, item.name, item.price, item.description, item.image, item.calories, item.protein, item.carbs, item.fat],
                  (err) => {
                    if (err) console.error(`Error migrating menu item ${item.name}:`, err);
                  }
                );
              }
            }
          }
        }
      );
    }
  }
});

// Close database connection after a short delay to ensure async operations complete
setTimeout(() => {
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    else console.log('Database migration verification/run complete.');
  });
}, 2000);
