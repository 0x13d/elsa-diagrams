import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { DownloadModal } from './DownloadModal';

type Kind = 'route' | 'anchor' | 'external';
interface NavItem {
  href: string;
  label: string;
  kind: Kind;
}

const NAV_ITEMS: NavItem[] = [
  { href: '#convert', label: 'Convert', kind: 'anchor' },
  { href: '/library', label: 'Library', kind: 'route' },
  { href: '/adrs', label: 'ADRs', kind: 'route' },
  { href: '#how', label: 'How it works', kind: 'anchor' },
  { href: 'https://github.com/ariugwu', label: 'GitHub', kind: 'external' },
];

export function Header() {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Close the mobile drawer on route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const goAnchor = (e: React.MouseEvent, hash: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const id = hash.slice(1);
    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: id } });
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openDownload = () => {
    setMenuOpen(false);
    setDownloadOpen(true);
  };

  const renderItem = (item: NavItem, mobile = false) => {
    const base = mobile ? 'py-2 text-inkSoft hover:text-ink transition-colors' : 'text-inkSoft hover:text-ink transition-colors';
    const active = 'text-ink';
    if (item.kind === 'external') {
      return (
        <a key={item.href} href={item.href} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} className={base}>
          {item.label}
        </a>
      );
    }
    if (item.kind === 'anchor') {
      return (
        <a key={item.href} href={item.href} onClick={(e) => goAnchor(e, item.href)} className={base}>
          {item.label}
        </a>
      );
    }
    return (
      <NavLink
        key={item.href}
        to={item.href}
        end
        onClick={() => setMenuOpen(false)}
        className={({ isActive }) => `${base} ${isActive ? active : ''}`}
      >
        {item.label}
      </NavLink>
    );
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="glass border-b border-ink/10"
      style={{ background: "#B7BEAF", boxShadow: "0 0 25px 0"}}
      >
        <div 
          className="mx-auto max-w-6xl px-6 sm:px-8 h-12 flex items-center justify-between text-[13px]"
          style={{ background: "#B7BEAF"}}
          >
          <NavLink to="/" className="flex items-center gap-2 text-ink hover:text-ember transition-colors">
            <Logo size={20} />
            <span className="font-medium tracking-tight">elsa-to-mermaid</span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-7">
            {NAV_ITEMS.map((item) => renderItem(item))}
            <button
              type="button"
              onClick={() => setDownloadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink text-paper hover:bg-ember transition-colors font-medium"
            >
              <DownloadIcon />
              Download
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="sm:hidden inline-flex items-center justify-center w-9 h-9 -mr-2 rounded-full hover:bg-ink/5 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        <div
          id="mobile-nav"
          className={`sm:hidden overflow-hidden transition-[max-height,opacity] duration-200 ease-out border-t border-ink/10 ${
            menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="mx-auto max-w-6xl px-6 py-3 flex flex-col gap-1 text-[15px]">
            {NAV_ITEMS.map((item) => renderItem(item, true))}
            <button
              type="button"
              onClick={openDownload}
              className="mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-ink text-paper hover:bg-ember transition-colors font-medium"
            >
              <DownloadIcon />
              Download
            </button>
          </nav>
        </div>
      </div>
      <DownloadModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />
    </header>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}
