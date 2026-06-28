import { Link, useParams } from 'react-router-dom';
import { ADRS, getAdr } from '../adrs';
import { renderMarkdown } from '../lib/renderMarkdown';

export function AdrsPage() {
  const { slug } = useParams();
  if (slug) return <AdrDetail slug={slug} />;
  return <AdrIndex />;
}

function AdrIndex() {
  return (
    <section className="mx-auto max-w-6xl px-6 sm:px-8 pt-16 sm:pt-20 pb-24">
      <div className="text-xs uppercase tracking-[0.22em] text-inkSoft">— ADRs</div>
      <h1 className="font-display text-4xl sm:text-5xl tracking-tight mt-3">
        Architectural decision records
      </h1>
      <p className="mt-5 max-w-2xl text-[16px] leading-[1.6] text-inkSoft">
        Short, hand-written notes on the design choices that shape this project. Each one
        captures the problem, the call, and the trade-offs accepted.
      </p>

      <ol className="mt-12 space-y-4">
        {ADRS.map((adr) => (
          <li key={adr.slug}>
            <Link
              to={`/adrs/${adr.slug}`}
              className="block rounded-2xl border border-ink/10 bg-paper shadow-inkSoft px-5 py-4 hover:border-ink/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[12px] text-inkSoft">ADR-{adr.number}</span>
                <StatusChip status={adr.status} />
                {adr.date && (
                  <span className="text-[12px] text-inkSoft">· {adr.date}</span>
                )}
              </div>
              <h2 className="mt-1 font-display text-2xl tracking-tight">{adr.title}</h2>
              <p className="mt-2 text-[14.5px] text-inkSoft leading-[1.55]">{adr.summary}</p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AdrDetail({ slug }: { slug: string }) {
  const adr = getAdr(slug);
  if (!adr) {
    return (
      <section className="mx-auto max-w-3xl px-6 sm:px-8 pt-20 pb-24">
        <div className="text-xs uppercase tracking-[0.22em] text-ember">— Not found</div>
        <h1 className="font-display text-3xl tracking-tight mt-3">No ADR matches “{slug}”</h1>
        <p className="mt-4 text-inkSoft">
          <Link to="/adrs" className="underline decoration-ember/40 hover:decoration-ember">
            ← Back to ADRs
          </Link>
        </p>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 sm:pt-20 pb-24">
      <div className="mb-6">
        <Link
          to="/adrs"
          className="text-[12px] uppercase tracking-[0.18em] text-inkSoft hover:text-ember transition-colors"
        >
          ← All ADRs
        </Link>
      </div>
      <div className="text-[12px] font-mono text-inkSoft">ADR-{adr.number}</div>
      <div className="adr-body mt-1 text-ink">{renderMarkdown(adr.markdown, `adr-${adr.slug}`)}</div>
    </article>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-[0.18em] rounded-full px-2 py-0.5 ${tone}`}
    >
      {status}
    </span>
  );
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('accept')) return 'bg-ink text-paper';
  if (s.includes('propos')) return 'border border-ember/40 text-ember';
  if (s.includes('superseded') || s.includes('deprecat'))
    return 'border border-ink/20 text-inkSoft line-through decoration-1';
  return 'border border-ink/15 text-inkSoft';
}
