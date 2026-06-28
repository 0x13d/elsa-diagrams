import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { elsaToCombined, elsaToMermaid, elsaToSpec } from '../dist/index.node.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../../../tests/fixtures');

let pass = 0;
let fail = 0;

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function smoke() {
  const v2 = readFileSync(resolve(fixtures, 'v2_if_branch.json'), 'utf8');
  const v3 = readFileSync(resolve(fixtures, 'v3_composite.json'), 'utf8');

  console.log('• v2_if_branch baseline');
  const out1 = await elsaToMermaid(v2);
  check('starts with flowchart TD', out1.startsWith('flowchart TD'));
  check('decision shape for activity-2', out1.includes('activity_2{"Check Status"}'));
  check('outcome label True is rendered', out1.includes('-->|True|'));
  check('Done outcome is omitted', !out1.includes('-->|Done|'));

  console.log('• v3_composite with LR + labelResolver');
  const out2 = await elsaToMermaid(v3, {
    direction: 'LR',
    labelResolver: (type, id) =>
      id === 'If1' ? 'Approved?' : type === 'Elsa.Sequence' ? 'Approval Flow' : undefined,
  });
  check('respects direction LR', out2.startsWith('flowchart LR'));
  check('resolver overrides If1 label', out2.includes('If1{"Approved?"}'));
  check('resolver overrides subgraph label', out2.includes('subgraph Sequence1["Approval Flow"]'));
  check('untouched labels remain', out2.includes('Signal1[/"Wait for Decision"/]'));

  console.log('• input as object (not string)');
  const out3 = await elsaToMermaid(JSON.parse(v2));
  check('object input produces same baseline', out3 === out1);

  console.log('• invalid JSON rejects');
  let caught = false;
  try {
    await elsaToMermaid('{not json}');
  } catch {
    caught = true;
  }
  check('throws on invalid JSON', caught);

  console.log('• elsaToSpec on v3_composite');
  const spec = await elsaToSpec(v3);
  check('spec has workflow title', spec.startsWith('# Document Approval'));
  check('spec marks per-activity anchors', spec.includes('<!-- elsa-activity: Sequence1 -->'));
  check('spec surfaces inbound flow', spec.includes("from `If1` *(via `True`)*"));
  check('spec recurses into Sequence children', spec.includes('<!-- elsa-activity: Signal1 -->'));

  console.log('• elsaToSpec curated HttpEndpoint block');
  const specV2 = await elsaToSpec(v2);
  check('spec emits HttpEndpoint block', specV2.includes('**Endpoint**'));
  check('spec extracts Path literal', specV2.includes('**Path:** `/document`'));

  console.log('• elsaToCombined inlines fenced mermaid');
  const combined = await elsaToCombined(v3);
  check('combined has ## Diagram heading', combined.includes('## Diagram'));
  check('combined contains fenced mermaid block', combined.includes('```mermaid'));
  check('combined contains flowchart line', combined.includes('flowchart TD'));
  check('combined includes Activities section', combined.includes('## Activities'));

  console.log('• elsaToCombined respects labelResolver inside fenced block');
  const combinedWithResolver = await elsaToCombined(v3, {
    labelResolver: (_t, id) => (id === 'If1' ? 'Approved?' : undefined),
  });
  check(
    'resolver rewrites diagram label only',
    combinedWithResolver.includes('If1{"Approved?"}')
  );
  check(
    'resolver leaves spec section untouched',
    combinedWithResolver.includes('## Check Approval')
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

smoke().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(2);
});
