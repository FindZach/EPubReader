import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Epub from 'epubjs';

const THEMES = {
  light:  { label: 'Light',  bg: '#ffffff', fg: '#1a1a1a', ui: 'bg-white text-slate-800' },
  sepia:  { label: 'Sepia',  bg: '#f8f1e3', fg: '#5b4636', ui: 'bg-amber-50 text-amber-900' },
  dark:   { label: 'Dark',   bg: '#1c1c1e', fg: '#e8e8e8', ui: 'bg-zinc-900 text-zinc-100' },
};

const FONT_SIZES = ['14px', '16px', '18px', '20px', '24px'];

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();

  const viewerRef = useRef(null);
  const bookRef   = useRef(null);
  const rendRef   = useRef(null);

  const [book, setBook]         = useState(null);
  const [toc, setToc]           = useState([]);
  const [showToc, setShowToc]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBar, setShowBar]   = useState(true);
  const [theme, setTheme]       = useState('light');
  const [fontSize, setFontSize] = useState('18px');
  const [location, setLocation] = useState({ cfi: null, percentage: 0, label: '' });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const hideBarTimer = useRef(null);

  // ── Auto-hide bars after 3s inactivity ────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowBar(true);
    clearTimeout(hideBarTimer.current);
    hideBarTimer.current = setTimeout(() => setShowBar(false), 3000);
  }, []);

  // ── Save progress (debounced) ──────────────────────────────────────────────
  const saveProgress = useCallback((cfi, percentage) => {
    fetch(`/api/books/${id}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cfi, percentage }),
    }).catch(() => {});
  }, [id]);

  // ── Init epub.js ───────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let loadingTimer;

    // Fetch book metadata
    fetch(`/api/books/${id}`)
      .then(r => r.json())
      .then(data => mounted && setBook(data))
      .catch(() => mounted && setError('Could not load book metadata'));

    // epub.js needs explicit pixel dimensions — percentage strings cause it to hang
    const container = viewerRef.current;
    const w = container.offsetWidth  || window.innerWidth;
    const h = container.offsetHeight || window.innerHeight - 96;

    const epubBook = new Epub(`/api/books/${id}/file`);
    bookRef.current = epubBook;

    const rendition = epubBook.renderTo(container, {
      width:  w,
      height: h,
      spread: 'none',
    });
    rendRef.current = rendition;

    // Clear loading when epub.js fires its first 'rendered' event
    rendition.on('rendered', () => {
      if (mounted) {
        setLoading(false);
        clearTimeout(loadingTimer);
      }
    });

    // Hard fallback: clear loading after 12 s regardless
    loadingTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 12000);

    // Apply saved theme + font size
    const storedTheme    = localStorage.getItem(`theme-${id}`) || 'light';
    const storedFontSize = localStorage.getItem(`fs-${id}`) || '18px';
    setTheme(storedTheme);
    setFontSize(storedFontSize);

    const t = THEMES[storedTheme] || THEMES.light;
    rendition.themes.default({
      body: {
        color:         t.fg,
        background:    t.bg,
        'font-size':   storedFontSize,
        'line-height': '1.7',
        'padding':     '0 2em !important',
        'font-family': 'Georgia, serif',
      },
      'p, li': { 'font-size': `${storedFontSize} !important` },
    });

    // Load saved progress, then display (fire-and-forget — 'rendered' handles loading state)
    fetch(`/api/books/${id}/progress`)
      .then(r => r.json())
      .then(prog => {
        if (!mounted) return;
        rendition.display(prog.cfi || undefined).catch(() => rendition.display().catch(() => {}));
      })
      .catch(() => {
        if (mounted) rendition.display().catch(() => {});
      });

    // Location change → save progress
    rendition.on('relocated', loc => {
      if (!mounted) return;
      const cfi = loc.start.cfi;
      const pct = loc.start.percentage ?? 0;
      setLocation({ cfi, percentage: pct, label: loc.start.href || '' });
      saveProgress(cfi, pct);
    });

    // Load TOC
    epubBook.loaded.navigation
      .then(nav => mounted && setToc(nav.toc || []))
      .catch(() => {});

    // Keyboard navigation
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendRef.current?.next();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   rendRef.current?.prev();
    };
    window.addEventListener('keydown', onKey);

    resetHideTimer();

    return () => {
      mounted = false;
      clearTimeout(loadingTimer);
      window.removeEventListener('keydown', onKey);
      clearTimeout(hideBarTimer.current);
      rendition.destroy();
      epubBook.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Apply theme change ─────────────────────────────────────────────────────
  const applyTheme = (name) => {
    const t = THEMES[name];
    setTheme(name);
    localStorage.setItem(`theme-${id}`, name);
    rendRef.current?.themes.default({
      body: {
        color:      t.fg,
        background: t.bg,
        'font-size': fontSize,
        'line-height': '1.7',
        'padding': '0 2em !important',
        'font-family': 'Georgia, serif',
      },
      'p, li': { 'font-size': `${fontSize} !important` },
    });
  };

  // ── Apply font size change ─────────────────────────────────────────────────
  const applyFontSize = (size) => {
    const t = THEMES[theme];
    setFontSize(size);
    localStorage.setItem(`fs-${id}`, size);
    rendRef.current?.themes.default({
      body: {
        color:      t.fg,
        background: t.bg,
        'font-size': size,
        'line-height': '1.7',
        'padding': '0 2em !important',
        'font-family': 'Georgia, serif',
      },
      'p, li': { 'font-size': `${size} !important` },
    });
  };

  // ── Navigate to TOC item ───────────────────────────────────────────────────
  const goToToc = (href) => {
    rendRef.current?.display(href);
    setShowToc(false);
  };

  const th = THEMES[theme] || THEMES.light;
  const pct = Math.round((location.percentage || 0) * 100);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">{error}</p>
        <button onClick={() => navigate('/')} className="text-brand-600 underline text-sm">Back to library</button>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col select-none"
      style={{ background: th.bg }}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
    >
      {/* Top bar */}
      <div
        className={`flex-shrink-0 flex items-center gap-2 px-3 h-12 z-20 transition-all duration-300 ${
          showBar ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        } ${th.ui} border-b border-black/10 shadow-sm`}
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Library</span>
        </button>

        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-semibold truncate">{book?.title || '…'}</p>
          {book?.author && <p className="text-xs opacity-50 truncate">{book.author}</p>}
        </div>

        <div className="flex items-center gap-1">
          {/* Table of contents */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(false); setShowToc(!showToc); }}
            title="Table of contents"
            className="w-9 h-9 rounded-lg hover:bg-black/10 flex items-center justify-center opacity-70 hover:opacity-100 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowToc(false); setShowSettings(!showSettings); }}
            title="Settings"
            className="w-9 h-9 rounded-lg hover:bg-black/10 flex items-center justify-center opacity-70 hover:opacity-100 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: th.bg }}>
            <svg className="w-8 h-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {/* Epub.js target */}
        <div ref={viewerRef} className="w-full h-full" />

        {/* Click zones: prev / next */}
        <button
          className="absolute left-0 top-0 w-1/4 h-full opacity-0"
          onClick={(e) => { e.stopPropagation(); rendRef.current?.prev(); resetHideTimer(); }}
          aria-label="Previous page"
        />
        <button
          className="absolute right-0 top-0 w-1/4 h-full opacity-0"
          onClick={(e) => { e.stopPropagation(); rendRef.current?.next(); resetHideTimer(); }}
          aria-label="Next page"
        />
      </div>

      {/* Bottom bar */}
      <div
        className={`flex-shrink-0 flex items-center justify-between px-4 h-10 z-20 transition-all duration-300 ${
          showBar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        } ${th.ui} border-t border-black/10`}
      >
        <button
          onClick={() => rendRef.current?.prev()}
          className="w-8 h-8 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Progress bar */}
        <div className="flex-1 mx-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs opacity-50 w-8 text-right tabular-nums">{pct}%</span>
        </div>

        <button
          onClick={() => rendRef.current?.next()}
          className="w-8 h-8 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* TOC drawer */}
      {showToc && (
        <div className="absolute inset-0 z-40 flex" onClick={() => setShowToc(false)}>
          <div
            className={`w-72 max-w-full h-full overflow-y-auto shadow-xl flex flex-col ${th.ui}`}
            style={{ background: th.bg }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-black/10">
              <h3 className="font-semibold text-sm">Table of Contents</h3>
              <button onClick={() => setShowToc(false)} className="opacity-50 hover:opacity-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {toc.length === 0 ? (
                <p className="text-sm opacity-40 p-4 text-center">No table of contents</p>
              ) : (
                <TocItems items={toc} onSelect={goToToc} />
              )}
            </nav>
          </div>
          <div className="flex-1 bg-black/30" />
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute inset-0 z-40 flex justify-end" onClick={() => setShowSettings(false)}>
          <div
            className={`w-64 h-full overflow-y-auto shadow-xl flex flex-col ${th.ui}`}
            style={{ background: th.bg }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-black/10">
              <h3 className="font-semibold text-sm">Reader Settings</h3>
              <button onClick={() => setShowSettings(false)} className="opacity-50 hover:opacity-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Theme */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-3">Theme</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(THEMES).map(([name, t]) => (
                    <button
                      key={name}
                      onClick={() => applyTheme(name)}
                      className={`rounded-lg p-3 text-xs font-medium border-2 transition-all ${
                        theme === name ? 'border-brand-500' : 'border-transparent'
                      }`}
                      style={{ background: t.bg, color: t.fg }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-3">Font Size</p>
                <div className="flex gap-1.5 flex-wrap">
                  {FONT_SIZES.map(sz => (
                    <button
                      key={sz}
                      onClick={() => applyFontSize(sz)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        fontSize === sz
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-black/10 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden" />
        </div>
      )}
    </div>
  );
}

function TocItems({ items, onSelect, depth = 0 }) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>
          <button
            onClick={() => onSelect(item.href)}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-black/10 transition-colors truncate"
            style={{ paddingLeft: `${(depth * 12) + 12}px` }}
          >
            {item.label}
          </button>
          {item.subitems?.length > 0 && (
            <TocItems items={item.subitems} onSelect={onSelect} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
