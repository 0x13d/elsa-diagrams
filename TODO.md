# TODO

## Register for Package Managers

* OpenVSX: https://open-vsx.org/user-settings/extensions
* VSCODE: https://marketplace.visualstudio.com/manage/publishers/0x13d
* NPM: https://www.npmjs.com/~13d
* https://crates.io/

## Github Release Secrets

NPM_TOKEN
CARGO_REGISTRY_TOKEN
VSCE_PAT
OVSX_PAT

## Help the Release Flow be a little easier to remember

After that, the release flow is: node scripts/bump-version.mjs X.Y.Z → review/edit CHANGELOG → commit → git tag vX.Y.Z && git push --tags. The tag fires the workflow, which builds and publishes everywhere. Run it via workflow_dispatch with dry_run: true first to verify the matrix builds cleanly.

### Improvements

Good afternoon. For the Elsa-to-Mermaid project I'd like to make the following changes:

* The mobile nav looks bunched up. Can we change this to a more responsive style?
* I'd like to have a new page which has a library of example workflows that load in the same preview/editor as the home page.
* Have another new page called 'ADRs' this will have ADRs (architectural decision records)
* Need to figure out a way to show and download complicated workflows on the library page. Here's an example to start off that shows my thinking:

Example Workflow A - File Watcher (CSV):

* Trigger: Watch a directory for CSV files.
* Parse: Base64 encode the CSV and pass it to Workflow B
* Pass results to Workflow C for audit logging

Example Workflow B - CSV2JSON:

* Input = Base64 encoded CSV
* Parse File: Parse the CSV into a JSON array

Example Workflow C - Audit:

* This is a big part of the best practices we hope to establish. The goal of this would be to read the entire workflow context and build a simple JSON report of what failed and why.
* This standard should inform best practices for how to standardize the input of and output of all activities and workflows so that it's standardized for what the audit expects. Decide a structure that can be shown on the site on the ADR page with this one being the 'Audit' pattern.

### Theming — adopt the portfolio web standard (EPIC-011, owner ask 2026-06-11)

* **[DONE 2026-06-11] Ink palette.** `tailwind.config.ts` tokens repointed to the Tufte paper/ink base +
  Ink accents: `paper #faf7f1` · `paperDim #f3eee4` · `ink #11120f` · `inkSoft #5a5a5a` · `rule #3a3a3a` ·
  `ember` (the old `#D94B17` orange accent) → **brass `#8a6d3b`** so existing `text-ember`/`bg-ember`
  resolve to it; added a `footer #3a3a3a` token. The ember-orange `rgba` literals in `index.css` + the
  mermaid `clusterBkg` (Convert/LibraryPage) repointed to brass. Web app builds clean; browser-verified.
* **[DONE 2026-06-11] `#3a3a3a` footer → ariugwu.com.** `components/Footer.tsx` is now the constant
  `#3a3a3a` footer with a link back to the **ariugwu.com home page**.
* **Scope note (2026-06-11):** the literal *two-column app-shell* layout was **not** imposed — this is a
  single-column marketing/tool site, and a full app-shell restructure would be wrong for it. Conformance to
  EPIC-011 is via the **Ink palette + the `#3a3a3a` footer + the home link** (see
  `_shared/web-standard/README.md`, which scopes the two-column layout to app shells). UI/UX lead to confirm.
