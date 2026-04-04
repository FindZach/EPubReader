import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function BookCard({ book, onDelete }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const pct = book.percentage ? Math.round(book.percentage * 100) : 0;

  return (
    <div
      className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 overflow-hidden flex flex-col"
      onClick={() => navigate(`/reader/${book.id}`)}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] bg-gradient-to-br from-brand-100 to-brand-50 overflow-hidden">
        {book.cover_file && !imgError ? (
          <img
            src={`/api/books/${book.id}/cover`}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-2">
            <svg className="w-10 h-10 text-brand-500 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-center text-xs font-medium text-brand-600 line-clamp-2 leading-snug">{book.title}</p>
          </div>
        )}

        {/* Progress overlay badge */}
        {pct > 0 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
            {pct}%
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{book.title}</p>
        {book.author && (
          <p className="text-xs text-slate-500 line-clamp-1">{book.author}</p>
        )}

        {/* Progress bar */}
        {pct > 0 && (
          <div className="mt-auto pt-2">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3-dot menu */}
      <div
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
      >
        <button className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {menuOpen && (
          <div
            className="absolute top-8 left-0 w-36 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-10"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              onClick={(e) => { e.stopPropagation(); navigate(`/reader/${book.id}`); }}
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Read
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(book.id); }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
