const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db, BOOKS_DIR, COVERS_DIR } = require('../db');
const { parseEpub } = require('../epub-utils');

const router = express.Router();

// Multer — save EPUB uploads to a temp location first
const upload = multer({
  dest: path.join(BOOKS_DIR, 'tmp'),
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/epub+zip'
      || file.originalname.toLowerCase().endsWith('.epub');
    cb(null, ok);
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// ── GET /api/books ────────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
  const books = db.prepare(`
    SELECT b.*, p.cfi, p.percentage, p.updated_at AS last_read
    FROM books b
    LEFT JOIN progress p ON p.book_id = b.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(books);
});

// ── POST /api/books/upload ────────────────────────────────────────────────────
router.post('/upload', upload.array('books', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No EPUB files received' });
  }

  const results = [];

  for (const file of req.files) {
    const id = uuidv4();
    const tmpPath = file.path;
    const finalPath = path.join(BOOKS_DIR, `${id}.epub`);

    try {
      // Move from tmp to permanent location
      fs.renameSync(tmpPath, finalPath);

      // Parse metadata + extract cover
      const { title, author, coverData, coverExt } = await parseEpub(finalPath);

      let coverFile = null;
      if (coverData) {
        coverFile = `${id}${coverExt}`;
        fs.writeFileSync(path.join(COVERS_DIR, coverFile), coverData);
      }

      const bookTitle = title || path.basename(file.originalname, '.epub');

      db.prepare(`
        INSERT INTO books (id, title, author, cover_file, file_name, file_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, bookTitle, author || null, coverFile, file.originalname, file.size, new Date().toISOString());

      results.push({ id, title: bookTitle, author: author || null });
    } catch (err) {
      // Clean up on failure
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      console.error(`Failed to process ${file.originalname}:`, err.message);
      results.push({ error: err.message, file: file.originalname });
    }
  }

  res.json(results);
});

// ── GET /api/books/:id ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const book = db.prepare(`
    SELECT b.*, p.cfi, p.percentage, p.updated_at AS last_read
    FROM books b
    LEFT JOIN progress p ON p.book_id = b.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

// ── GET /api/books/:id/file ───────────────────────────────────────────────────
router.get('/:id/file', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const filePath = path.join(BOOKS_DIR, `${book.id}.epub`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Type', 'application/epub+zip');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.file_name)}"`);
  res.sendFile(filePath);
});

// ── GET /api/books/:id/cover ──────────────────────────────────────────────────
router.get('/:id/cover', (req, res) => {
  const book = db.prepare('SELECT cover_file FROM books WHERE id = ?').get(req.params.id);
  if (!book || !book.cover_file) return res.status(404).end();

  const coverPath = path.join(COVERS_DIR, book.cover_file);
  if (!fs.existsSync(coverPath)) return res.status(404).end();

  res.sendFile(coverPath);
});

// ── GET /api/books/:id/progress ───────────────────────────────────────────────
router.get('/:id/progress', (req, res) => {
  const progress = db.prepare('SELECT * FROM progress WHERE book_id = ?').get(req.params.id);
  res.json(progress || { cfi: null, percentage: 0 });
});

// ── PUT /api/books/:id/progress ───────────────────────────────────────────────
router.put('/:id/progress', (req, res) => {
  const { cfi, percentage } = req.body;
  const bookId = req.params.id;

  const exists = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!exists) return res.status(404).json({ error: 'Book not found' });

  db.prepare(`
    INSERT INTO progress (book_id, cfi, percentage, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(book_id) DO UPDATE SET
      cfi = excluded.cfi,
      percentage = excluded.percentage,
      updated_at = excluded.updated_at
  `).run(bookId, cfi || null, percentage || 0, new Date().toISOString());

  res.json({ ok: true });
});

// ── DELETE /api/books/:id ─────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  // Remove files
  const filePath = path.join(BOOKS_DIR, `${book.id}.epub`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (book.cover_file) {
    const coverPath = path.join(COVERS_DIR, book.cover_file);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  }

  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
