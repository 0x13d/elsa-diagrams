import { useEffect } from 'react';

type DownloadModalProps = {
  open: boolean;
  onClose: () => void;
};

type Channel = {
  id: string;
  name: string;
  blurb: string;
  meta: string;
  href: string;
  cta: string;
  icon: JSX.Element;
};

const CHANNELS: Channel[] = [
  {
    id: 'npm',
    name: 'npm',
    blurb: 'Install the JavaScript package for Node or the browser.',
    meta: 'npm i elsa-to-mermaid',
    href: 'https://www.npmjs.com/package/elsa-to-mermaid',
    cta: 'View on npm',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5">
        <rect x="2" y="6" width="20" height="12" fill="currentColor" />
        <path d="M5 9h4v6H7.5V10.5H6.5V15H5V9zm6 0h5v6h-2.5V10.5h-1V15H11V9zm7 0h3v4.5h-1.5V15H18V9z" fill="#F7F4EE" />
      </svg>
    ),
  },
  {
    id: 'vscode',
    name: 'VS Code Marketplace',
    blurb: 'Preview-to-the-side for any Elsa workflow JSON.',
    meta: 'ariugwu.elsa-to-mermaid',
    href: 'https://marketplace.visualstudio.com/items?itemName=0x13D.elsa-to-mermaid',
    cta: 'Open Marketplace',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5">
        <path
          fill="currentColor"
          d="M17.5 2.5 22 5v14l-4.5 2.5L8 13.6l-4.7 3.6L1 16V8l2.3-1.2L8 10.4l9.5-7.9zM8 12 4 9v6l4-3zm9 .1L11.2 12 17 17.1V6.9L11.2 12 17 11.9z"
        />
      </svg>
    ),
  },
  {
    id: 'cli',
    name: 'CLI binary',
    blurb: 'Single-file Rust binary — macOS, Linux, Windows.',
    meta: 'elsa-mermaid-cli',
    href: 'https://github.com/ariugwu/elsa-to-mermaid/releases/latest',
    cta: 'Download from Releases',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 19h16" />
      </svg>
    ),
  },
];

export function DownloadModal({ open, onClose }: DownloadModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 sm:px-6 animate-fadeIn"
    >
      <button
        type="button"
        aria-label="Close download dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm cursor-default"
      />

      <div
        className="relative w-full max-w-lg bg-paper border border-ink/15 rounded-2xl shadow-inkSoft animate-riseIn overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-7 pb-5 border-b border-ink/10">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-inkSoft">
            <span className="inline-block w-6 h-px bg-ink/30" />
            <span>Get elsa-to-mermaid</span>
          </div>
          <h2
            id="download-title"
            className="mt-3 font-display text-3xl leading-tight tracking-tightest"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
          >
            Pick a <em className="not-italic text-ember" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}>surface</em>.
          </h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-inkSoft">
            Same Rust core, three ways to use it.
          </p>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full border border-ink/15 hover:border-ink/40 hover:bg-paperDim text-inkSoft hover:text-ink transition-colors flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <ul className="divide-y divide-ink/10">
          {CHANNELS.map((c) => (
            <li key={c.id}>
              <a
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-4 px-7 py-4 hover:bg-paperDim/60 transition-colors"
              >
                <span className="mt-0.5 w-10 h-10 rounded-xl bg-ink text-paper group-hover:bg-ember transition-colors flex items-center justify-center shrink-0">
                  {c.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[15px] font-medium text-ink">{c.name}</span>
                    <span className="font-mono text-[11px] text-inkSoft truncate">{c.meta}</span>
                  </span>
                  <span className="block mt-0.5 text-[13px] text-inkSoft leading-[1.5]">{c.blurb}</span>
                </span>
                <span className="mt-2 text-[12px] text-inkSoft group-hover:text-ember transition-colors whitespace-nowrap">
                  {c.cta} →
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
