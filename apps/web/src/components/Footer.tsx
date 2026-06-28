import { Logo } from './Logo';

export function Footer() {
  // Portfolio web-standard footer (EPIC-011): constant #3a3a3a, links back to the
  // ariugwu.com home page. See _shared/web-standard/README.md.
  return (
    <footer className="bg-footer text-paper/75">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-10 flex items-center justify-between flex-wrap gap-4 text-[12px]">
        <div className="flex items-center gap-2">
          <Logo size={16} />
          <span>elsa-to-mermaid · 0.1.0</span>
        </div>
        <a
          href="https://ariugwu.com"
          className="inline-flex items-center gap-1.5 text-paper/85 hover:text-paper transition-colors"
        >
          <span aria-hidden="true">←</span>
          ariugwu.com
        </a>
      </div>
    </footer>
  );
}
