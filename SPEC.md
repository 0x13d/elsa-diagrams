# SPEC — elsa-to-mermaid

> **Status:** authoritative for conversion behavior. Code is the source of truth;
> this document explains the contract behind it. For build commands, repository
> layout, and Claude-specific operational notes, see [CLAUDE.md](./CLAUDE.md).
> For release history, see [CHANGELOG.md](./CHANGELOG.md).

---

## Pipeline

```text
                                          ┌──► render      → Mermaid string
JSON string → detect (V2 | V3) → normalize ┤
                                          └──► render_spec → Markdown spec sheet
```

The normalize stage produces a single `WorkflowIR`. Two renderers consume it
independently — `render` emits the Mermaid flowchart, `render_spec` emits a
Markdown spec sheet. `render_combined` is a convenience that concatenates both
with a fenced `mermaid` block.

Five pure stages. The only runtime dependency is `serde_json`. No regex crates,
no HTTP, no filesystem access in the library.

---

## Elsa schemas

### Elsa 2.x

Root object has `activities` (array) and `connections` (array) at the top level.

- Activities use `activityId` (not `id`)
- Connections use `sourceActivityId` / `targetActivityId` / `outcome`

```json
{
  "activities": [
    { "activityId": "activity-1", "type": "HttpEndpoint", "displayName": "HTTP Endpoint" },
    { "activityId": "activity-2", "type": "If", "displayName": "Check Status" }
  ],
  "connections": [
    { "sourceActivityId": "activity-1", "targetActivityId": "activity-2", "outcome": "Done" }
  ]
}
```

**Detection rule:** root has `activities` array AND its first element has `activityId`.

### Elsa 3+

Activities nested under `root.activities`; connections under `root.connections`.
Activities use `id` (not `activityId`).

```json
{
  "id": "workflow-1",
  "name": "Document Approval",
  "root": {
    "id": "Flowchart1",
    "type": "Elsa.Flowchart",
    "activities": [
      { "id": "HttpEndpoint1", "type": "Elsa.Http.HttpEndpoint", "displayName": "Receive Document" }
    ],
    "connections": [
      { "source": "HttpEndpoint1", "target": "If1", "sourcePort": "Done", "targetPort": "In" }
    ]
  }
}
```

**Detection rule:** root object has a `root` key whose value is an object with an
`activities` array.

#### V3 connection variants

Both must parse:

- **Flat:** `{ "source": "id1", "target": "id2", "sourcePort": "Done", "targetPort": "In" }`
- **Nested:** `{ "source": { "activity": "id1", "port": "Done" }, "target": { "activity": "id2", "port": "In" } }`

Tell them apart by inspecting whether `connection.source` is a string or an object.

---

## Intermediate representation

Version-agnostic. All rendering operates on this type. Defined in
[`crates/elsa_mermaid/src/ir.rs`](crates/elsa_mermaid/src/ir.rs).

```rust
pub struct WorkflowIR {
    pub id: String,
    pub name: String,
    pub version: Option<u32>,
    pub definition_id: Option<String>,
    pub is_published: Option<bool>,
    pub is_latest: Option<bool>,
    pub nodes: Vec<ActivityNode>,
    pub edges: Vec<EdgeIR>,
}

pub struct ActivityNode {
    pub id: String,
    pub activity_type: String,          // raw type from JSON
    pub display_name: Option<String>,
    pub is_start: bool,                 // computed: no inbound edge
    pub shape: NodeShape,
    pub children: Option<Box<WorkflowIR>>, // Some(_) for composites
    pub properties: Vec<PropertyIR>,    // ordered; preserves JSON declaration order
    pub extras: BTreeMap<String, Value>,// well-known config flags only
}

pub enum NodeShape { Default, Decision, Terminal, Blocking }

pub struct PropertyIR {
    pub name: String,
    pub value: serde_json::Value,
    pub syntax: Option<String>,         // V2: "Literal"/"JavaScript"/"Liquid"; V3: type of expression
}

pub struct EdgeIR {
    pub source_id: String,
    pub target_id: String,
    pub outcome: String,                // "" means unlabeled arrow
    pub target_port: Option<String>,    // V3 only — V2 has no target port
}
```

`extras` is populated only for these keys when present and non-null on the
activity JSON: `persistWorkflow`, `loadWorkflowContext`, `saveWorkflowContext`,
`saveWorkflowInstance`, `runAsynchronously`, `description`, `metadata`. Everything
else from the activity JSON is discarded.

---

## Normalization

### V2

- `id` ← `json.id` || `json.definitionId` || `"unknown"`
- `name` ← `json.name` || `"Unnamed Workflow"`
- `version` ← `json.version` as `u32` if present
- Activities: iterate `json.activities` → `ActivityNode { id: activityId, activity_type: type, display_name: displayName, shape: classify_shape(type), children: None }`
- Edges: iterate `json.connections` → `EdgeIR { source_id, target_id, outcome: outcome || "Done" }`
- Compute `is_start` = no edge has this node as target

### V3

- `id`, `name`, `version` resolved from top-level JSON (same fallbacks as V2)
- Entry point: `normalize_v3_composite(root_object)`
- For each activity under `container.activities`:
  - If the activity has its own `activities` array → composite → recurse and set `children`
  - Otherwise → leaf node
- Connections (`container.connections`): handle both flat and nested format (see above)
- Compute `is_start` the same way

#### Sequence implicit chaining

When a composite's last type segment equals `"Sequence"` (case-insensitive) **and**
its `connections` array is empty, generate implicit `Done` edges chaining children
sequentially. This is what produces `Email1 --> Signal1` inside the `Sequence1`
subgraph of the canonical `v3_composite` fixture, even though that fixture has no
inner connections defined.

If a Sequence composite *does* have explicit connections, use those — do not add
implicit ones.

---

## Label sanitization

`sanitize_type(activity_type)` in [`label.rs`](crates/elsa_mermaid/src/label.rs):

1. Strip namespace: keep only the last `.`-separated segment.
   - `"Elsa.Http.HttpEndpoint"` → `"HttpEndpoint"`
2. Split PascalCase on uppercase-after-lowercase or uppercase-after-uppercase-before-lowercase boundaries.
   Runs of consecutive uppercase stay together as acronyms.
   - `"HttpEndpoint"` → `["Http", "Endpoint"]`
   - `"HTTPEndpoint"` → `["HTTP", "Endpoint"]`
   - `"IORead"` → `["IO", "Read"]`
3. Join with single space.
4. If the result is more than 28 characters, truncate to 27 and append `…`.

`activity_label(node)`:

- Return `node.display_name` verbatim if present.
- Otherwise return `sanitize_type(node.activity_type)`.

**`displayName` wins.** No sanitization is applied to `displayName` — what the
author wrote is what gets rendered. (The original brief showed an inconsistent
example output where `"HTTP Endpoint"` rendered as `"Http Endpoint"`; that example
was wrong, the rule is right.)

---

## Shape classification

`classify_shape(activity_type)` matches the **last `.`-separated segment** of the
type, case-insensitive, against these patterns in order. First match wins.

| Pattern (substring, case-insensitive)                              | Shape      | Mermaid syntax |
|--------------------------------------------------------------------|------------|----------------|
| `if`, `switch`, `fork`                                             | `Decision` | `{"label"}`    |
| `endpoint`, `trigger`, `start`, `timer`, `cron`, `webhook`         | `Terminal` | `(["label"])`  |
| `signal`, `receive`, `wait`, `blocking`, `approve`, `suspend`      | `Blocking` | `[/"label"/]`  |
| `finish`, `fault`, `terminate`                                     | `Terminal` | `(["label"])`  |
| (anything else)                                                    | `Default`  | `["label"]`    |

`Sequence` is intentionally **not** mapped — when a Sequence has children, it
renders as a subgraph, not a node, so shape is irrelevant.

---

## Render

`render(ir, opts)` in [`render.rs`](crates/elsa_mermaid/src/render.rs).

### Output structure

```text
flowchart {direction}

{node declarations}

{edge declarations}
```

`direction` ∈ `TD | LR | BT | RL`. Default is `TD`. Output always ends with exactly
one trailing newline.

### Node declarations

Per shape (where `{id}` is the sanitized Mermaid id, `{label}` is the escaped label):

- `Default`:  `    {id}["{label}"]`
- `Decision`: `    {id}{{"{label}"}}` *(Mermaid syntax for diamond)*
- `Terminal`: `    {id}(["{label}"])`
- `Blocking`: `    {id}[/"{label}"/]`

### Subgraphs

For nodes whose `children.is_some()`:

```text
    subgraph {id}["{label}"]
        {child node declarations}
        {child edge declarations}
    end
```

After the closing `end`, edges connecting to/from the subgraph id render normally
at the outer level.

### Edges

- If `outcome` is empty **or** equals `"Done"`: `{src} --> {tgt}` (preceded by four spaces of indentation)
- Otherwise: `{src} -->|{outcome}| {tgt}` (preceded by four spaces of indentation)

`"Done"` is the implicit success path; omitting it from the arrow keeps diagrams
readable. (The original brief's example output showed `|Done|` labels, but the
rule it stated — and the rule we implement — is to omit them.)

### Id sanitization

`mermaid_id(id)` replaces every non-`[a-zA-Z0-9_]` character with `_`. Applied
consistently to both source and target in every edge declaration so renames match
on both ends.

### Label escaping

Labels are wrapped in `"…"`. Any `"` inside a label is escaped to `#quot;` (Mermaid's
HTML-entity convention). Single quotes are left alone — Mermaid treats them
differently.

### Start nodes

A node with no inbound edges has `is_start: true`, but rendering does not force a
shape change. The diagram structure carries the start signal visually.

---

## Spec sheet

`render_spec(ir)` in [`spec.rs`](crates/elsa_mermaid/src/spec.rs) emits a Markdown
document describing the workflow. It is generated from the same `WorkflowIR` as
`render` — no second pass over the input JSON.

### Output structure

```text
# {workflow.name}

**Workflow ID:** `{id}` &middot; **Definition ID:** `…` &middot; **Version:** `…` &middot; …

<!-- elsa-activity: {id} -->
## {displayName or sanitized type}

**Id:** `{id}` &middot; **Type:** `{sanitized type}` &middot; **Shape:** {shape} &middot; **Role:** Start

{curated property block | default properties list}

**Configuration**
- **{flag}:** {value}

**Flow**
- **In:** {sources} | _(start)_
- **Out:** {targets with outcomes} | _(terminal)_
```

Each activity section is preceded by an HTML comment marker
(`<!-- elsa-activity: {id} -->`). Markers are standard HTML comments, so they
pass through every Markdown renderer unchanged. Downstream tooling (the web app
Tufte view and the VS Code preview) splits the document on these markers to
reconstruct per-activity records.

Composite activities (those with `children: Some(_)`) render their inner
activities as nested sections one heading level deeper, with the parent section
ending in `_Composite activity. Inner steps:_`.

### Curated pretty-printers

When an activity's type tail (last `.`-separated segment, case-insensitive)
matches one of these patterns, `render_spec` emits a curated block keyed to that
activity type. Properties are looked up case-insensitively by name; missing
properties render as `_(unspecified)_`.

| Tail (lowercased)                    | Block heading      | Properties surfaced |
|--------------------------------------|--------------------|---------------------|
| `httpendpoint`                       | **Endpoint**       | `Path`, `Methods`/`SupportedMethods`, `ReadContent`, `Authorize` |
| `httpresponse`, `writehttpresponse`  | **HTTP response**  | `StatusCode`, `ContentType`, `Content` |
| `if`, `ifelse`                       | **Branch condition** | `Condition` (as fenced code block) |
| `switch`                             | **Switch cases**   | `Cases[].name`, `Cases[].condition` |
| `sendemail`                          | **Email message**  | `From`, `To`, `Cc`, `Bcc`, `Subject`, `Body` |
| `signalreceived`, `receivesignal`    | **Awaits signal**  | `Signal`/`SignalName` |
| `sendsignal`                         | **Sends signal**   | `Signal`/`SignalName`, `Input` |
| `writeline`                          | **Writes line**    | `Text` |
| `timer`                              | **Timer**          | `Timeout`/`Interval` |
| `cron`, `cronevent`                  | **Cron trigger**   | `CronExpression` |
| `delay`                              | **Delay**          | `TimeSpan`/`Duration` |
| `setvariable`                        | **Set variable**   | `Variable`/`VariableName`, `Value` |

Anything else falls back to a generic **Properties** definition list
(`- **{name}** *(syntax)*: {value}`).

### Value formatting

`format_value_inline(value)` handles a property value as a single span:

- `null` → `_(unset)_`
- `bool`, `number` → backticked
- `string` (empty) → `_(empty string)_`; (multiline) → `_(multiline — see below)_`; (single line) → backticked
- Elsa v3 expression objects of the shape `{ "type": SYNTAX, "value": V }` → format the inner value plus a trailing italic `*(SYNTAX)*` annotation
- Other arrays/objects → compact `serde_json` rendering inside backticks

For multiline or known-expression values, the renderer can emit a fenced code
block instead (`format_value_block`). Language hint comes from `syntax` mapping:
`JavaScript`/`js` → `javascript`, `CSharp`/`c#` → `csharp`, `Liquid` → `liquid`,
`Literal`/`Object`/`JSON` → unfenced language.

### Configuration block

If the activity's `extras` map is non-empty, the block emits one bullet per
entry. Keys are sorted alphabetically (the map is a `BTreeMap`).

### Flow block

`In`: every edge with `target_id == node.id`. Each entry is `from \`{source}\``,
optionally annotated with the outcome (`*(via \`outcome\`)*`) when the outcome is
neither empty nor `Done`, and an explicit target port (`→ port \`{port}\``) when
`target_port` is `Some(_)` and not `In`.

`Out`: every edge with `source_id == node.id`. Each entry is
`\`{outcome}\` → \`{target}\``, where `outcome` defaults to `\`Done\`` for the
implicit success path.

When the activity has no inbound or outbound edges, the `Flow` block is omitted
entirely.

### `render_combined`

`render_combined(ir, mermaid)` returns a single document with this structure:

- `# {workflow.name}` heading
- Workflow meta chips line
- `## Diagram` heading
- Fenced ` ```mermaid ` block containing the rendered Mermaid string
- `## Activities` heading
- Activity sections (per `render_spec`), with headings shifted one level deeper

Useful for downstream Markdown renderers that want a single document.

---

## Public API surface

### Rust (`crate elsa_mermaid`)

```rust
pub fn convert(workflow_json: &str, opts: &ConvertOptions) -> Result<String, String>;
pub fn convert_spec(workflow_json: &str) -> Result<String, String>;
pub fn convert_combined(workflow_json: &str, opts: &ConvertOptions) -> Result<String, String>;

#[derive(serde::Deserialize, Default)]
pub struct ConvertOptions {
    pub direction: DirectionOpt,
}

#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum DirectionOpt { #[default] TD, LR, BT, RL }
```

`convert_spec` ignores `ConvertOptions` (the spec sheet has no direction).

### WASM (`#[cfg(feature = "wasm")]`)

```rust
#[wasm_bindgen]
pub fn convert_to_mermaid(workflow_json: &str, options_json: &str) -> Result<String, JsValue>;

#[wasm_bindgen]
pub fn convert_to_spec(workflow_json: &str) -> Result<String, JsValue>;

#[wasm_bindgen]
pub fn convert_to_combined(workflow_json: &str, options_json: &str) -> Result<String, JsValue>;
```

### npm package (`elsa-to-mermaid`)

```ts
export type LabelResolver = (activityType: string, activityId: string) => string | undefined;

export interface ConvertOptions {
  direction?: 'TD' | 'LR' | 'BT' | 'RL';
  labelResolver?: LabelResolver;
}

export function elsaToMermaid(
  workflow: string | object,
  options?: ConvertOptions
): Promise<string>;

export function elsaToSpec(
  workflow: string | object
): Promise<string>;

export function elsaToCombined(
  workflow: string | object,
  options?: ConvertOptions
): Promise<string>;
```

`labelResolver` runs as a string-replacement post-processing pass on the Mermaid
output. It cannot cross the WASM boundary, so the resolver function executes in JS
only — overriding labels by activity id/type after the Rust core has emitted the
diagram. Returning `undefined` falls through to the default sanitized label.

When passed to `elsaToCombined`, the resolver is applied only to the fenced
` ```mermaid ` block inside the document — Markdown prose outside that block is
left untouched.

### CLI (`elsa-to-mermaid`)

```text
elsa-to-mermaid [INPUT] [-o OUTPUT] [-d TD|LR|BT|RL]
                       [-f mermaid|spec|combined] [--spec] [--combined] [--fenced]
```

- `-f mermaid` (default) — raw Mermaid diagram.
- `-f spec` / `--spec` — Markdown spec sheet only.
- `-f combined` / `--combined` — workflow meta + fenced Mermaid + per-activity sections.
- `--fenced` wraps the Mermaid output in a ` ```mermaid ` block; ignored for
  non-mermaid formats.

`--spec`, `--combined`, and `--format` are mutually exclusive. Exits non-zero
with a stderr message on any parse or conversion error.

---

## Test fixtures

Canonical inputs live in [`tests/fixtures/`](tests/fixtures/) and are referenced by
both Rust integration tests and the Node smoke. Treat them as part of the public
contract — renaming or restructuring them is a behavior change.

- `v2_if_branch.json` — minimal V2 with three-way branch
- `v2_document_approval.json` — V2 with `SendSignal` blocking activity
- `v3_hello_world.json` — single-activity V3
- `v3_composite.json` — V3 with a Sequence subgraph

---

## Constraints

- No HTTP, no network, no filesystem in the library.
- `serde_json` is the only JSON dependency. No jsonpath, no regex.
- Library code uses `Result` propagation everywhere; `unwrap()` is only acceptable
  in test code and the CLI's `main()` (after a user-facing error message).
- The WASM build is the same Rust core, gated behind `--features wasm`.
