const express = require('express');
const cors = require('cors');
const path = require('path');

const booksRouter = require('./routes/books');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/books', booksRouter);

// Serve React build in production
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Catch-all: send index.html for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EPUB Reader running on http://0.0.0.0:${PORT}`);
});
