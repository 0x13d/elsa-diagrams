# ADR-0001 · The Audit Pattern

**Status:** Proposed
**Date:** 2026-05-19
**Deciders:** elsa-to-mermaid maintainers

## Context

Elsa workflows are easy to write and easy to chain. They are not, by default,
easy to *audit*. Every author tends to invent their own way of saying "this run
succeeded", "this run failed and here is why", or "this run processed N items".
When something goes wrong in production — or when ops wants a daily report —
there is no single shape to query.

We need a small, agreed-upon contract that lets any workflow:

1. Report its own outcome to a shared auditor.
2. Be inspected uniformly across the catalog.
3. Carry just enough correlation data to trace a chain of subworkflow calls.

The constraint is severity: this is a *convention*, not a runtime change to
Elsa. Workflow authors must be able to opt in without new infrastructure.

## Decision

Adopt a shared **Audit Pattern** with two complementary parts: an input
envelope that any workflow can pass to a central Audit workflow, and a
canonical Audit Report shape that the auditor emits in return.

### The Audit Envelope (input to Workflow C)

Every workflow that wants to report results calls the central audit workflow
with a small structured object:

```json
{
  "source": "workflow-a-filewatcher",
  "status": "ok",
  "error": null,
  "count": 12,
  "ref": "/var/data/inbox/2026-05-19.csv"
}
```

- **`source`** — *required*. The calling workflow's `definitionId` or
  human-stable name. Lets the auditor group runs by producer.
- **`status`** — *required*. One of `ok` / `failed` / `partial`. The single
  field every downstream consumer can sort on.
- **`error`** — *optional*. Human-readable failure reason. Only meaningful
  when `status !== 'ok'`.
- **`count`** — *optional*. How many records the run processed, when that
  notion applies. Use `null` for non-batch workflows.
- **`ref`** — *optional*. A caller-supplied correlation handle — a filename,
  a URL, a row id. The auditor does not parse it; it preserves it.

Workflows that produce structured output of their own (Workflow B returns
`{ rows, error }`) wrap the relevant signal into the envelope at the call site.
The envelope intentionally hides the producer's domain model from the
auditor.

### The Audit Report (output from Workflow C)

The auditor normalizes the envelope into a canonical report and emits it
back to the caller:

```json
{
  "runId": "wf-1758-3c2a",
  "source": "workflow-a-filewatcher",
  "status": "ok",
  "error": null,
  "count": 12,
  "ref": "/var/data/inbox/2026-05-19.csv",
  "observedAt": "2026-05-19T14:33:01.482Z"
}
```

Compared to the envelope, the report adds:

- **`runId`** — Elsa's workflow instance id. The single hook that lets two
  audit entries be correlated back to the same physical run.
- **`observedAt`** — RFC 3339 timestamp captured by the auditor, not the
  caller. Trustworthy for downstream sort/filter.

The auditor *never invents* a missing field. If the caller omits `count`,
the report keeps `count: null`. Consumers can tell "not applicable" from
"zero".

### Auditor behavior

The auditor (Workflow C) is responsible for three things, in order:

- **Normalize** — build the canonical report from whatever the caller sent.
- **Alert on failure** — publish `audit.workflow.failed` for any non-`ok`
  status, attaching the full report as payload. Subscribers decide whether
  to page, email, or sink to a dashboard.
- **Persist** — append the report to the `audit_log` store, success or
  failure. The persistence step is the same for both paths so the audit
  trail stays complete.

## Consequences

**Positive**

- One shape to learn. Any workflow author can wire up audit in under five
  minutes by calling Workflow C with the envelope.
- One shape to query. Downstream tooling (dashboards, alert routes,
  CSV exports) reads the report shape and nothing else.
- The contract is small enough to enforce in code review without tooling.

**Negative**

- Workflows that want richer audit data have to flatten it into the
  envelope or attach it via `ref`. Resist the urge to grow `count` into a
  union — keep the envelope minimal.
- The auditor is now a critical-path subworkflow. A failure inside Workflow
  C silently loses an audit entry. Mitigation: keep the auditor extremely
  simple, run it in fire-and-forget mode where the caller doesn't block on
  its response, and monitor the `audit_log` write rate separately.

**Out of scope (for this ADR)**

- Retention policy for `audit_log`. Future ADR.
- Schema evolution. The current report shape is v1; additions will be
  additive (new optional fields), removals or renames require a new ADR.

## Related

- Example implementations live in the [Library](/library):
  - Workflow A demonstrates a caller (file watcher) that uses the envelope.
  - Workflow B is a pure subworkflow with its own structured output, which
    gets translated into envelope shape by the caller.
  - Workflow C is the auditor itself.
