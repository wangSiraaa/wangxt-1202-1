const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'drug_ad_review.db');
const db = new DatabaseSync(dbPath, {
  enableForeignKeyConstraints: true,
  timeout: 5000
});

db.exec('PRAGMA journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      drug_name TEXT NOT NULL,
      approval_number TEXT,
      indication TEXT,
      contraindication TEXT,
      medical_evidence TEXT,
      risk_warning TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      current_step TEXT NOT NULL DEFAULT 'MARKETING',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS medical_opinions (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      indication_check INTEGER DEFAULT 0,
      contraindication_check INTEGER DEFAULT 0,
      evidence_check INTEGER DEFAULT 0,
      opinion TEXT,
      suggestion TEXT,
      is_approved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS legal_opinions (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      approval_number_check INTEGER DEFAULT 0,
      risk_warning_check INTEGER DEFAULT 0,
      off_label_check INTEGER DEFAULT 0,
      opinion TEXT,
      suggestion TEXT,
      is_approved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS audit_trails (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      remark TEXT,
      changes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS published_versions (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      drug_name TEXT NOT NULL,
      approval_number TEXT,
      indication TEXT,
      contraindication TEXT,
      medical_evidence TEXT,
      risk_warning TEXT,
      published_by TEXT NOT NULL,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_locked INTEGER DEFAULT 1,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_materials_step ON materials(current_step);
    CREATE INDEX IF NOT EXISTS idx_trails_material ON audit_trails(material_id);
    CREATE INDEX IF NOT EXISTS idx_medical_material ON medical_opinions(material_id);
    CREATE INDEX IF NOT EXISTS idx_legal_material ON legal_opinions(material_id);
  `);

  console.log('Database initialized successfully');
  return db;
}

module.exports = { db, initDatabase };
