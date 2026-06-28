# Trust Report — elsa-to-mermaid

_Generated 2026-05-18T18:14:32Z_

Static supply-chain checks. Re-run via `bash scripts/trust-report.sh`.
Artifacts in `reports/trust/`; only this `summary.md` is committed.

| Status | Check | Detail |
|--------|-------|--------|
| OK | SBOM (syft) | 386 components — sbom.cyclonedx.json, sbom.spdx.json |
| WARN | npm audit (apps/vscode-extension) | 1 vulnerabilities — audit-npm-apps_vscode-extension.json |
| OK | npm audit (apps/web) | 0 vulnerabilities — audit-npm-apps_web.json |
| OK | npm audit (packages/elsa-to-mermaid) | 0 vulnerabilities — audit-npm-packages_elsa-to-mermaid.json |
| INFO | npm audit (packages/elsa-to-mermaid-cli) | see audit-npm-packages_elsa-to-mermaid-cli.json |
| INFO | npm audit (packages/elsa-to-mermaid/wasm-node) | see audit-npm-packages_elsa-to-mermaid_wasm-node.json |
| OK | cargo audit | 0 vulnerabilities — audit-cargo.json |
| OK | cargo deny | no findings — cargo-deny.txt |
| OK | Licenses | 386 components, 10 distinct — licenses.csv |
| INFO | Network-call inventory | 5 source matches — network-calls.txt (review for outbound) |

## Artifacts

- audit-cargo.json
- audit-npm-apps_vscode-extension.json
- audit-npm-apps_web.json
- audit-npm-packages_elsa-to-mermaid-cli.json
- audit-npm-packages_elsa-to-mermaid.json
- audit-npm-packages_elsa-to-mermaid_wasm-node.json
- cargo-deny.txt
- licenses.csv
- network-calls.txt
- sbom.cyclonedx.json
- sbom.spdx.json

## Reproduce

```sh
bash scripts/trust-report.sh
```

Tools used (when present): syft, npm/pnpm audit, cargo-audit, cargo-deny, jq.
