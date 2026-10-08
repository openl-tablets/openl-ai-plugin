# Structure and Data Artifact Contract

> Contract-Version: 1.2

This contract defines the boundary between logging and reapplication. The logging procedure is in `log-contract.md`; the reapplication procedure is in `reapply-contract.md`.

## Artifact partition

Portable OpenL replay has two ordered phases:

1. **Structure** — operations whose `elementType` is `column`.
2. **Data** — operations whose `elementType` is `row`.

Never mix row and column operations in one change-set file. Use these suffixes:

- `<base>.structure.openl-changeset.json`
- `<base>.data.openl-changeset.json`

If only one phase has operations, produce only that phase file while retaining its explicit suffix. Never produce an empty phase file.

## Paired artifact invariants

When both files are present:

- Both are `OpenLChangeSet` documents with the same `schemaVersion`, validated against the unchanged `openl-change-set.schema.json` bundled with this skill.
- Both target the same project.
- Each has a unique `metadata.changeSetId`, normally using `-structure` or `-data` suffixes.
- Each declares `metadata.phase` (`structure` or `data`) and, when both files exist, `metadata.pairedFile`; the schema rejects a file whose operations do not match its phase.
- Structure is always evaluated and executed before data.
- Data snapshots describe the table layout after the complete structure phase.

Within each file, operation `order` values are positive and unique. Preserve dependency order within the phase; array position should match it, but consumers sort by `order`.

## Normalized data invariant

A data artifact contains at most one effective row mutation for a complete target selector and semantic key derived from `keyFields` plus the applicable complete row state. Key-value-changing edits are represented as a remove under the old derived key followed by an add under the new derived key.

Logging must satisfy this invariant before writing the artifact. Reapplication validates the invariant and rejects a violation; it never normalizes or repairs an input artifact.
