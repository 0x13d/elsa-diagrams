export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 sm:px-8 pb-32">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-inkSoft">03 — Pipeline</div>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mt-1">Four stages.</h2>
        </div>
        <p className="max-w-md text-sm text-inkSoft text-pretty">
          <ul>
            The same Rust core runs in the CLI, the npm package, a VSCode extension and this page. No backend, no network — your workflow JSON never leaves the tab.
          </ul>
        </p>
      </div>

      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            n: '01',
            t: 'Detect',
            d: 'Sniff version: V3 if root.activities exists, V2 if activities[0].activityId exists. Anything else: refuse.'
          },
          {
            n: '02',
            t: 'Normalize',
            d: 'Collapse both schemas into one shape-agnostic IR. Compute is_start, recurse composites.'
          },
          {
            n: '03',
            t: 'Classify',
            d: 'Map activity types to one of four Mermaid shapes — terminal, decision, blocking, default.'
          },
          {
            n: '04',
            t: 'Render',
            d: 'Emit Mermaid with subgraphs for composites, Done outcomes unlabeled, IDs sanitized.'
          }
        ].map((s) => (
          <li
            key={s.n}
            className="relative rounded-xl border border-ink/10 bg-paper p-5 hover:border-ink/30 transition-colors"
          >
            <div className="font-mono text-[11px] text-ember tracking-[0.18em]">{s.n}</div>
            <div className="font-display text-xl mt-1 mb-2 tracking-tight">{s.t}</div>
            <p className="text-[13.5px] leading-[1.55] text-inkSoft text-pretty">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
