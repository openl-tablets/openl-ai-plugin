# Optimizing and performance

Part of the decision-tables skill, moved word for word from its SKILL.md. Non-negotiables, Workflow, Writing the table, Verification checklist and Scope and sources are in short form in [SKILL.md](../SKILL.md) and in full in [non-negotiables.md](non-negotiables.md) and [workflow-and-writing.md](workflow-and-writing.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

## Optimizing an existing table


Use this when the task is to make existing tables shorter, clearer or easier to update. The target is the most compact layout a person can read and update without mistakes, returning the same result for every input (Non-negotiable 7).

**Patterns to look for:**

- **A list of key combinations → a lookup grid.** When one key repeats over a small set of values (every band appears once per gender, per tier, per plan), move that key across the top, and keep moving keys up, stacked as several horizontal conditions, while the table stays readable (Lookup layout). The rows shrink by that key's number of values, and each value sits at the crossing a person looks for.
- **The better orientation.** The key with the most or the longest values goes down the rows and the others across the top; a table wider than a screen moves a horizontal key back down. When the axes of a lookup are swapped, check that every horizontal condition still takes the right input; a reordered signature is a signature change (Non-negotiable 6). A transposed table (rules as columns) is read correctly by OpenL, but people update rows more easily; use it only where the siblings do.
- **Rows with the same result.** Values the requirement keeps on separate lines stay in separate rows, even when their results are equal: values that change separately are easier to validate and update in separate rows. Combine them into a comma-separated list or one band only when the user asks.
- **Repeated condition values** are merged to show the groups.
- **Unreachable and duplicate rows** are removed (Completeness and conflicts). Rows are positional when a return cell reads the rule number or rule name, so in such a table removing or reordering rows changes results; leave it as it is and report it.
- **The wrong table type.** A Rules table that a Smart table can express, a Data table scanned with `select`, or a ternary chain in a spreadsheet step (with the skill that builds Spreadsheet tables) becomes a SmartRules or SmartLookup table.
- **Tables that share keys.** Two tables with the same keys that are always read together may become one table with a compound return or one lookup. This changes the signature for every caller: propose it and go through Non-negotiable 6.
- **Column order.** Simple conditions before expression conditions: they read first and, as the guide notes, match faster.

**Procedure:**

1. **Agree the limits.** Values, results and the signature stay unchanged unless the user says otherwise. Work on a separate branch.
2. **Record the current results.** Run the current table over its full value domain (the domain run in Completeness and conflicts) and keep the results, together with the module's test results.
3. **Show the new layout first.** Render the proposed table in the reply next to the current one and get the user's agreement on the layout before writing it.
4. **Rewrite and prove.** Write the new table, compile, repeat the domain run and the tests: every result must be identical to step 2.
5. **Report.** For each table: the layout before and after (rows and columns), why it is easier to read and update, and a statement that every result and the signature are unchanged. List what was left as it is and why.

## Performance


- **Match, don't scan.** A decision table finds its row faster than a `select` over an array. Values a calculation looks up per element belong in a Smart table (Non-negotiable 8).
- **Plain conditions over expressions.** An expression condition is evaluated for every row checked. Prefer Smart or Simple tables with plain conditions to Rules tables with complex expressions, and put simple conditions before expression conditions.
- **No table calls inside conditions.** A return cell that calls another table runs only for the matching row; a condition that calls a table runs for every row checked. Compute such a value once in the caller and pass it in as an input.
- **Fewer rows.** Ranges where the requirement gives ranges and, for an input without a vocabulary, an agreed catch-all instead of listing every remaining value. Rows the requirement lists one per value are not combined for speed.
- **One call per input set.** A lookup called again and again with the same inputs is the caller's problem: call it once and reference the result (see the skill that builds Spreadsheet tables).
- **Properties stay.** Keep `cacheable` and other Dev properties as the project has them; never add one as a shortcut.
- **Measure** with Studio's Benchmark on an integration test when performance is the task, as described in the skill that builds Spreadsheet tables.
