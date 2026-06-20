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

function tableExists(tableName) {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);
  return !!row;
}

function getColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
}

function addColumnIfNotExists(tableName, columnName, columnDef) {
  const columns = getColumns(tableName);
  if (!columns.includes(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    console.log(`[migration] 已为 ${tableName} 添加列 ${columnName}`);
    return true;
  }
  return false;
}

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
      is_deleted INTEGER DEFAULT 0,
      theme_id TEXT,
      channel TEXT DEFAULT 'POSTER',
      evidence_source TEXT,
      revised_from_id TEXT,
      revision_reason TEXT
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
      rejection_reason TEXT,
      evidence_source TEXT,
      channel TEXT,
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
      rejection_reason TEXT,
      channel TEXT,
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
      channel TEXT DEFAULT 'POSTER',
      evidence_source TEXT,
      revision_reason TEXT,
      revised_from_id TEXT,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS evidence_versions (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      theme_id TEXT,
      channel TEXT,
      version INTEGER NOT NULL,
      evidence_source TEXT,
      medical_evidence TEXT NOT NULL,
      snapshot_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );
  `);

  addColumnIfNotExists('materials', 'theme_id', 'TEXT');
  addColumnIfNotExists('materials', 'channel', "TEXT DEFAULT 'POSTER'");
  addColumnIfNotExists('materials', 'evidence_source', 'TEXT');
  addColumnIfNotExists('materials', 'revised_from_id', 'TEXT');
  addColumnIfNotExists('materials', 'revision_reason', 'TEXT');

  addColumnIfNotExists('medical_opinions', 'rejection_reason', 'TEXT');
  addColumnIfNotExists('medical_opinions', 'evidence_source', 'TEXT');
  addColumnIfNotExists('medical_opinions', 'channel', 'TEXT');

  addColumnIfNotExists('legal_opinions', 'rejection_reason', 'TEXT');
  addColumnIfNotExists('legal_opinions', 'channel', 'TEXT');

  addColumnIfNotExists('published_versions', 'channel', "TEXT DEFAULT 'POSTER'");
  addColumnIfNotExists('published_versions', 'evidence_source', 'TEXT');
  addColumnIfNotExists('published_versions', 'revision_reason', 'TEXT');
  addColumnIfNotExists('published_versions', 'revised_from_id', 'TEXT');

  db.exec(`
    UPDATE materials SET theme_id = id WHERE theme_id IS NULL;
    UPDATE published_versions SET channel = 'POSTER' WHERE channel IS NULL;
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_materials_step ON materials(current_step);
    CREATE INDEX IF NOT EXISTS idx_materials_theme ON materials(theme_id);
    CREATE INDEX IF NOT EXISTS idx_materials_channel ON materials(channel);
    CREATE INDEX IF NOT EXISTS idx_trails_material ON audit_trails(material_id);
    CREATE INDEX IF NOT EXISTS idx_medical_material ON medical_opinions(material_id);
    CREATE INDEX IF NOT EXISTS idx_legal_material ON legal_opinions(material_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_versions_material ON evidence_versions(material_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_versions_theme ON evidence_versions(theme_id);
  `);

  console.log('Database initialized successfully');
  return db;
}

module.exports = { db, initDatabase, addColumnIfNotExists };
