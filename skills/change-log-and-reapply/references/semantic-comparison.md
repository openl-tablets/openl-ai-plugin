# Semantic Comparison

## General rules

- Compare user-visible field names exactly.
- Treat the captured optional `type` only as the JSON literal kind (`string`, `integer`, `decimal`, `boolean`, or `null`). The schema intentionally stores collection-valued cells as strings; `type` does not identify them.
- Decide whether a string represents a collection from live OpenL evidence for the affected live OpenL field or dimension: use its table declaration, header/type metadata, or an unambiguous OpenL collection representation such as enclosing list brackets. Commas alone are insufficient because ordinary scalar text may contain commas.
- If either side of the same field or dimension is identified as collection-valued, compare both string representations as sets. There is no ordered-collection comparison mode.
- If the captured and live strings are exactly equal after permitted representation normalization, treat them as equal even when collection metadata is unavailable.
- For a value that is not a collection-valued string, compare the OpenL scalar kind and value. `1`, `"1"`, `true`, and `"true"` are not interchangeable. Treat integer and decimal forms as equal only when the live OpenL declaration places them in the same numeric domain and their numeric values are equal.
- For a collection-valued string, remove at most one enclosing pair of OpenL collection brackets, parse top-level members with OpenL collection syntax, trim delimiter-adjacent whitespace, and compare the resulting unique member sets independent of order. Preserve case and spelling. Commas inside quoted or nested member syntax are not delimiters.
- Duplicate members do not affect equality because comparison is by set membership. An empty string remains the captured blank/wildcard scalar and is not converted to an empty set.
- Preserve the artifact's original string when writing. Set canonicalization is comparison-only; never rewrite or reorder the captured value.
- If serialized strings differ and the live table cannot establish whether the value is collection-valued, stop with `AMBIGUOUS_VALUE_SEMANTICS`. Do not guess from the captured JSON `type`, Excel formatting, or comma-separated text.
- Require complete semantic state equality for edit `before`, edit `after`, and remove row state. For a cataloged target, omit its `Generated order field` from the live row before comparison and reject an artifact that captured it. Missing, additional, or changed ordinary semantic fields are unequal.
- Verify a cataloged generated order value separately after an add. It is transport/order state and never participates in semantic key or row-content equality. Edits preserve it; removals neither compare nor renumber it.

## Rows

Resolve a row only through the persisted semantic selector derived from `keyFields` and the applicable complete row state. For add/remove use `fields`; for edit use `before.fields` after proving every derived value is unchanged in `after.fields`. A key match must be unique. Do not fall back to a row number, cataloged generated order field, MCP row ID, table ID, or best-effort partial match.

For add-row similarity, check both:

1. equality of the selector derived from `keyFields` and `fields`; and
2. equality of the complete captured semantic fields, including fields named by `keyFields`, plus all dimension tuples and their values, after omitting only the target's cataloged generated order field from live state.

Either match is a conflict. If the table read cannot prove uniqueness or absence, the state is ambiguous and therefore conflicts.

## Columns

Trim incidental surrounding whitespace from a user-visible label before comparison, but preserve case and internal whitespace. Compare OpenL expressions exactly as exposed, except for line-ending normalization when the MCP transport changes only `CRLF` versus `LF`.

Treat the expression as the column's semantic identity. A label is presentation metadata and is not unique: multiple columns may have the same normalized label when their expressions target different values.

For an add, an exact expression match is a conflict. A normalized label match with a different expression is allowed and must not be reported as a conflict. If the expression matches but the normalized label differs, report drift rather than treating the requested column as absent.

For a remove, require exactly one column to match both label and expression. If the expression matches under a different normalized label, report drift. A label-only match with a different expression neither identifies nor blocks the requested column; when no exact pair exists, the requested column is absent. Multiple exact pairs or an uninterpretable header are ambiguous and therefore conflict.

## Dimension tuples

Dimension comparison must reproduce the logging normalization in `dimension-normalization.md`:

1. Read the merged header grid needed for the affected row.
2. Expand every `rowspan` and `colspan`; each covered position inherits exactly one anchor value.
3. Reject unreadable, multiply anchored, or orphaned covered cells.
4. Identify the complete set of registered dimension names. Header position is useful for reading the table but is not part of semantic identity.
5. For each logical value column, collect exactly one value for every registered dimension and form a name-to-value mapping. Physical column position is not part of semantic identity.
6. A confirmed blank header cell normalizes to `""` and means wildcard. Missing or `null` dimensions are invalid, not wildcards.
7. Captured values are already normalized at log time (enclosing list brackets removed). Normalize the live value the same way, then compare collection members as an unordered set using the rules above.
8. Preserve boolean, integer, and decimal header values as scalars.

Treat each `dimensions` array as an unordered mapping from unique dimension name to semantic value. Treat `dimensionValues` as an unordered mapping from that canonical dimension mapping to its fields. Two dimension states are equal when they contain the same unique dimension names, the same semantic value for each name, the same set of canonical tuples, and equal associated fields for every tuple. Array order, header order, and physical column order do not affect equality. Missing, additional, duplicated, or changed dimension names, tuples, or values are unequal. Never fall back to physical columns or ranges.
