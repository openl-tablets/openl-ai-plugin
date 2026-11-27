# Performance reference

Read in performance mode: a slow rater, a benchmark over its threshold, or "make this faster". Part of the calculations skill; the targets, fix order and `cacheable` rule below were moved word for word from the Performance section of its [SKILL.md](../SKILL.md), which keeps a one-line rule with the thresholds. The baseline and benchmark come from the testing skill (SKILL.md, Hand-offs).

## Contents

- Targets and fix order
- Patterns that save execution time
- Optimizing an existing calculation

## Targets and fix order

- Targets, unless the project sets its own: ≤ 100 ms normal; ≤ 1 s acceptable only for heavy batch calculations; ≤ 10 s poor; > 10 s blocker. Response < 10 KB (hide intermediate steps with `~` or mark outputs with `*`).
- Timings come from the testing skill's baseline and benchmark (Hand-offs), never from a single run.
- Fix order: repeated rule calls → duplicated `select` / `flatten` → response size → peer review.
- Keep `cacheable`, `parallel` and `calculateAllCells` as the project has them; never introduce `cacheable` as a shortcut for a duplicated-call problem.

## Patterns that save execution time


- Compute once at the highest level, then split. Prepare a shared array once at the parent (e.g. filter and group the census once at policy level), split it with `split by` by the key the children need, and pass each child its group. Never re-filter it per class or per element with `select all having` (Non-negotiables 5 and 6, [non-negotiables.md](non-negotiables.md); Example 2 in [worked-examples.md](worked-examples.md)). The same applies to large reference data passed in as an input: split it once by its key, then each element reads its group.

- Reuse steps, never duplicate them. Each rule call, `select`, `flatten` or sorted array exists in one step and is referenced with `$Step` everywhere else (Non-negotiable 4); a nested spreadsheet is called once and its steps are read from that result. Every duplicate runs again, so its cost is paid twice.

- Loop only over the elements that matter. Filter the array to the relevant elements before passing it to a per-element table, rather than calculating every element and dropping the unneeded results later.

- Don't run a full calculation to get a few fields. When a later step needs only some values per element, compute them in a small table that returns just those values, instead of running the complete per-element calculation over the whole array.

- Pass plain values into repeated work. When a table runs many times (an iteration, a search) over an array of spreadsheet results, extract the one value it needs once (`$Results.$Amount` → `Double[]`) and pass that array, instead of reading the step from every result on every pass.

- Replace a tiny per-element spreadsheet with an expression. A short calculation applied to every element can often be one `transform to` expression over the array (`census [transform to …]`), which avoids one spreadsheet call per element.

- Look values up in a SmartRules / SmartLookup / SimpleLookup table instead of `select first having` over a Data table; decision tables match faster than scanning an array.

- `select first having` stops at the first match; never `[select all having …][0]`, and never `select all` + `flatten` when the key is unique.

- Sort, filter or `flatten` an array once in its own step, never inside a looped table.

- Guard an expensive call with a condition (`= isNotEmpty ($Discount) ? Calc ($Discount)`) so it only runs when its result is needed.

- A small helper called for every element of a large array can return a single value instead of SpreadsheetResult, so no result matrix is built per call.

- Fixed values belong in a Constants table or a step at the top, not in a rule called per element.

- Hide large intermediate arrays with `~`; a big response costs serialization time on every call.

## Optimizing an existing calculation

Use this when the task is to make existing rules faster.

1.  **Agree the limits.** Business logic and the API (request, response, exposed methods) stay unchanged unless the user says otherwise; no `cacheable` shortcuts. Work on a separate branch.

2.  **Baseline first.** Through the testing skill, record the behaviour and timings of the largest realistic request and the full test run before any change (warmed-up runs; the median of several, since single runs vary by up to about 25%). Nothing is changed until that baseline exists.

3.  **Find the hot tables.** Run Studio's profiler or a trace on the large case and list the tables with the highest self time and call count. Look for the patterns in Patterns that save execution time above: work repeated per element that does not vary per element, repeated scans of a large array, full calculations run for a few fields.

4.  **Fix one pattern at a time.** Re-run the tests after each fix; every test must give the same results as before.

5.  **Prove the result.** Through the testing skill, re-run the baseline: all tests pass with identical results, the large request returns an identical response, and the benchmark is re-measured the same way. Rank the fixes by measured gain; drop or mark as optional a fix that gains nothing on realistic requests.

6.  **Report.** For each fix: where (tables and steps), before → after, and why it is faster. Then the before/after timings with test sizes, and a statement that the API and outputs are unchanged, and a business summary for the commit. Mark changed cells so a reviewer can find them.
