const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const BOOKS_DIR = path.join(DATA_DIR, 'books');
const COVERS_DIR = path.join(DATA_DIR, 'covers');
const DB_PATH = path.join(DATA_DIR, 'epub-reader.db');

fs.mkdirSync(BOOKS_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id        TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    author    TEXT,
    cover_file TEXT,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS progress (
    book_id    TEXT PRIMARY KEY,
    cfi        TEXT,
    percentage REAL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );
`);

module.exports = { db, DATA_DIR, BOOKS_DIR, COVERS_DIR };
