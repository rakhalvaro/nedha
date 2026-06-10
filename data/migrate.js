const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'nedha.db');
const backupPath = path.join(__dirname, 'database.json.bak');

if (!fs.existsSync(backupPath)) {
  console.log('Tidak ada database.json.bak untuk dimigrasikan.');
  process.exit(0);
}

const db = new Database(dbPath);

try {
  // Ensure tables exist
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
  `);

  // Read backup
  const raw = fs.readFileSync(backupPath, 'utf8');
  const backupData = JSON.parse(raw);

  // Migrate Analytics
  if (backupData.analytics) {
    const stmt = db.prepare(`INSERT OR REPLACE INTO analytics (key, value) VALUES (?, ?)`);
    for (const [key, val] of Object.entries(backupData.analytics)) {
      stmt.run(key, val);
    }
  }

  // Migrate Partners
  if (Array.isArray(backupData.partners)) {
    const titleCase = (c) => c.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    
    const stmtPartner = db.prepare(`
      INSERT OR REPLACE INTO partners (id, name, description, address, phone, logo, category, categories, rating) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const stmtMenu = db.prepare(`
      INSERT OR REPLACE INTO menu_items (id, partner_id, name, price, description, image, calories, protein, carbs, fat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

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

      stmtPartner.run(
        partner.id, partner.name, partner.description, partner.address, partner.phone, partner.logo, partner.category, categoriesJson, partner.rating
      );
      console.log(`Migrated partner: ${partner.name}`);

      // Migrate Menu Items
      if (Array.isArray(partner.menu)) {
        for (const item of partner.menu) {
          stmtMenu.run(
            item.id, partner.id, item.name, item.price, item.description, item.image, item.calories, item.protein, item.carbs, item.fat
          );
        }
      }
    }
  }

  console.log('Database migration verification/run complete.');
} catch (err) {
  console.error('Migration failed:', err);
} finally {
  db.close();
}
