# Dimension Normalization

## Goal

Convert physical OpenL value columns into semantic tuples such as:

```json
{
  "dimensions": [
    { "name": "Tier", "value": "Basic" },
    { "name": "Product", "value": "ProdA" },
    { "name": "Region", "value": "NY" }
  ],
  "fields": {
    "Default Value": { "value": "true", "type": "boolean" }
  }
}
```

The output must not mention the original Excel column.

## Required algorithm

1. Read the complete merged header grid needed to interpret the affected row, plus the complete affected row values. A rendered row summary without its header mapping is insufficient. If OpenL MCP cannot expose the header bands separately, read the full live table source as a fallback but keep only the operation-scoped header and row evidence in the log.
2. Materialize the header grid:
   - An anchor cell contributes its value to every grid position covered by its `colspan` and `rowspan`.
   - A `covered` placeholder inherits the corresponding anchor value. It is not a blank or wildcard unless that anchor is itself confirmed blank.
   - Refuse to log the operation if a covered cell cannot be traced to exactly one anchor; never normalize an unreadable or missing cell to a wildcard.
   - Preserve the left-to-right order of logical value columns for deterministic serialization only. Physical position is not semantic identity.
3. Identify the dimension-header rows and their user-visible names.
4. For each logical value column, collect one `(dimension name, normalized value)` entry from every dimension-header row. Every registered dimension must occur exactly once in every tuple. Header-row order may be retained for deterministic serialization but is not semantic.
5. Pair the row's value field or fields with that exact tuple.
6. Refuse to log the operation if two logical columns normalize to the same tuple or a tuple is incomplete.

## Value normalization

- Trim incidental surrounding whitespace.
- After merged cells have been expanded, encode a confirmed blank dimension-header cell as the empty string `""`. This explicitly represents an OpenL wildcard.
- Do not use `null` for a wildcard and do not omit a wildcard dimension. `null` or omission means the tuple is invalid or incomplete, not wildcarded.
- Keep text values as strings.
- Preserve comma-separated value order exactly as exposed by the table. This preserves source serialization; when the string represents a collection, replay compares its members as an unordered set.
- For an OpenL list-like dimension cell, remove only the single enclosing list brackets used by the table representation. For example, `[NY]` becomes `NY`, and `[AK, AL, CA]` becomes `AK, AL, CA`.
- Do not split collection-like values into arrays, sort them, expand them into separate tuples, or wrap them in an MCP scalar object. Do not infer collection semantics from commas alone.
- Preserve boolean, integer, and decimal dimension-header values as scalars. A header exposed as a number remains a number; never infer Money or convert the value into an MCP/API object. A null dimension-header value is invalid rather than a wildcard.

Reapplication compares dimension states with exactly this normalization; the
comparison rules are owned by `semantic-comparison.md` (Dimension tuples).

Never fall back to remembered columns such as `G:J` when tuple comparison fails.
