import { useEffect, useRef } from 'react';
import { parseSpec, type SpecBlock, type SpecSection } from '../lib/parseSpec';
import { renderBody, renderInline } from '../lib/renderInline';

interface PaperProps {
  /** Mermaid source string. Rendered as SVG inline by the parent. */
  mermaidCode: string;
  /** Markdown spec sheet (NOT combined) produced by elsaToSpec(). */
  specMarkdown: string;
  /** Render the diagram SVG into the supplied host. Called once per code change. */
  renderDiagram: (host: HTMLElement, code: string) => void | Promise<void>;
}

/**
 * Tufte-style combined view: workflow header, full-width figure (the Mermaid
 * diagram), then per-activity sections where curated property detail lives in
 * the right margin column. On narrow screens the margin collapses inline.
 */
export function Paper({ mermaidCode, specMarkdown, renderDiagram }: PaperProps) {
  const diagramHost = useRef<HTMLDivElement>(null);
  const parsed = parseSpec(specMarkdown);

  useEffect(() => {
    if (!diagramHost.current || !mermaidCode) return;
    renderDiagram(diagramHost.current, mermaidCode);
  }, [mermaidCode, renderDiagram]);

  return (
    <article className="tufte-paper text-ink">
      <header className="tufte-header">
        <div className="text-[10.5px] uppercase tracking-[0.28em] text-inkSoft mb-2">
          Workflow specification
        </div>
        <h1 className="font-display text-[clamp(1.8rem,3.2vw,2.6rem)] leading-[1.05] tracking-tight text-balance">
          {parsed.meta.title || 'Workflow'}
        </h1>
        {parsed.meta.chips.length > 0 && (
          <p className="mt-3 text-[13.5px] text-inkSoft leading-[1.6]">
            {parsed.meta.chips.map((chip, i) => (
              <span key={i} className="tufte-chip">
                {renderInline(chip, `mchip-${i}-`)}
                {i < parsed.meta.chips.length - 1 && (
                  <span className="text-ink/30 mx-2" aria-hidden>
                    ·
                  </span>
                )}
              </span>
            ))}
          </p>
        )}
      </header>

      <figure className="tufte-figure">
        <div
          ref={diagramHost}
          className="tufte-diagram-host mermaid-host bg-paperDim/40 border border-ink/10 rounded-2xl p-6"
        />
        <figcaption className="mt-2 text-[12px] uppercase tracking-[0.18em] text-inkSoft">
          Figure 1 · Flow diagram
        </figcaption>
      </figure>

      <h2 className="tufte-section-title mt-12 mb-2 font-display text-[1.5rem] leading-tight tracking-tight">
        Activities
      </h2>
      <p className="text-[13.5px] text-inkSoft leading-[1.6] mb-6 max-w-prose">
        Each activity below corresponds to a node in the figure above. Configuration
        and runtime detail appears in the margin.
      </p>

      <div className="tufte-sections">
        {parsed.sections.map((s) => (
          <ActivitySection key={s.id} section={s} />
        ))}
      </div>
    </article>
  );
}

function ActivitySection({ section }: { section: SpecSection }) {
  const flow = section.blocks.find((b) => b.heading === 'Flow');
  const config = section.blocks.find((b) => b.heading === 'Configuration');
  const propertyBlock = section.blocks.find(
    (b) => b.heading !== 'Flow' && b.heading !== 'Configuration' && b.heading !== 'Notes'
  );
  const notes = section.blocks.find((b) => b.heading === 'Notes');

  return (
    <section
      id={`activity-${section.id}`}
      data-elsa-id={section.id}
      className={`tufte-activity depth-${section.depth}`}
    >
      <div className="tufte-main">
        <h3 className="font-display text-[1.25rem] leading-tight tracking-tight">
          <span className="tufte-anchor">{section.title}</span>
        </h3>
        {section.chips.length > 0 && (
          <p className="mt-1 text-[12.5px] text-inkSoft leading-[1.55]">
            {section.chips.map((chip, i) => (
              <span key={i}>
                {renderInline(chip, `c-${section.id}-${i}-`)}
                {i < section.chips.length - 1 && (
                  <span className="text-ink/30 mx-2" aria-hidden>
                    ·
                  </span>
                )}
              </span>
            ))}
          </p>
        )}
        {flow && <BlockBody block={flow} sectionId={section.id} compact />}
        {notes && <BlockBody block={notes} sectionId={section.id} />}
        {section.isComposite && (
          <p className="mt-2 text-[12.5px] uppercase tracking-[0.18em] text-inkSoft">
            Composite — inner steps follow.
          </p>
        )}
      </div>

      <aside className="tufte-margin" aria-label="Sidenote">
        {propertyBlock && (
          <div className="tufte-sidenote">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-ember mb-1">
              {propertyBlock.heading}
            </div>
            <BlockBody block={propertyBlock} sectionId={section.id} compact />
          </div>
        )}
        {config && (
          <div className="tufte-sidenote">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-inkSoft mb-1">
              {config.heading}
            </div>
            <BlockBody block={config} sectionId={section.id} compact />
          </div>
        )}
      </aside>
    </section>
  );
}

function BlockBody({
  block,
  sectionId,
  compact = false,
}: {
  block: SpecBlock;
  sectionId: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'tufte-body tufte-body-compact' : 'tufte-body'}>
      {renderBody(block.body, `b-${sectionId}-${block.heading}`)}
    </div>
  );
}
