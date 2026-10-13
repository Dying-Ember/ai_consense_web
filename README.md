# ConSense web

Vue 3 frontend for contract drafting, vetting and advice. The drafting workflow keeps upload and parsing, review of candidate values and human adoption, then review and export of NTT/SCT/SCC documents. The optional relationship graph reads the current catalogue and action plan; it does not create a second business rule catalogue.

The OER integration adds identity-bound fixed and project evidence, source-page verification, Vetting progress and report exports, review-to-advice handoff, and Advisory sessions with validated flowcharts. Use the matching [companion service](https://github.com/s1765029698/ai_consense_service) contracts; model weights and databases belong to the service deployment.

## Run

Use Node.js compatible with the checked-in Vite/Vue toolchain. From this directory:

```powershell
npm ci
$env:CONSENSE_API_TARGET = 'http://localhost:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

Set the API target to the companion service's actual port. This frontend requires the companion service contracts for catalogue, plan, source bytes, document bindings and saved revisions. Provider keys and stored project documents remain service configuration and are not embedded here. Frontend startup alone does not establish backend or model readiness.

For the current shared MiniMax-M3 relay, follow [MiniMax relay setup, testing and development handoff](docs/minimax-relay-handoff.md). Run the companion backend with `h2,minimax-relay`, set `CONSENSE_API_TARGET` to that local backend, and keep the independent relay token in backend/client configuration. The frontend does not store a token. The handoff also describes using MiniMax for real-model regression tests and code analysis/modification, followed by independent validation.

```powershell
npm run typecheck
npm run build
```

## Portable verification

```powershell
Get-ChildItem -LiteralPath ./tests -Filter '*.test.cjs' | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Failed: $($_.Name)" }
}
node scripts/test-drafting-step3-scope.mjs
node scripts/test-drafting-step3-workspace.mjs
node scripts/test-vetting-view.mjs
node scripts/test-advice-scope-view.mjs
node scripts/test-vetting-progress.mjs
```

The control/model tests use authored fixtures and declared API/file/provider boundaries. They do not establish live model accuracy or universal Word/PDF layout. The synthetic DOCX fixture is authored test data, not a competition original.

`tests/fixtures/drafting-step12-baseline.vue` is the exact historical source of the first/second-step scope baseline at `aaa0e928`. The scope script uses this relative fixture so the test remains reproducible without importing private development Git history. This baseline is not a new business rule.

`scripts/test-inspection-ocr-diagnostics.mjs` additionally requires an authorised external `tests/fixtures/inspection-ocr-diagnostics.actual.json` fixture. The original local OCR output is excluded; that optional replay cannot run from this repository alone. See the fixture README for the boundary, and do not present a substituted fixture as the original observation.

Core business specifications and the glossary are included. Internal task trackers, historical verification records, local evidence links, private interaction-reference URLs, planning reports, communications, source originals, uploads, databases, provider keys, installed dependencies and generated artifacts are excluded from publication.

The canonical evidence tests use the authored JSON and PNG fixtures under `tests/fixtures/canonical`. These are protocol fixtures, not competition sources or OCR accuracy gold. They allow the frontend checks to run without a sibling service checkout.
