# Trace operations by connection version

Read from `SKILL.md` → Phase 2 after checking which trace operations the
connection to OpenL Studio offers. There are two generations; follow the path
whose operations are available and never call one that is not.

## Contents

- [Path A — tree trace](#path-a--tree-trace-trace-nodes-are-available)
- [Path B — interactive debugger](#path-b--interactive-debugger-step-and-watch-cells-are-available)
- [When a trace won't start](#when-a-trace-wont-start)

Both paths take the wrapped input described in SKILL.md → Phase 2.

## Path A — tree trace (trace nodes are available)

This is the older connection (`openl-mcp` 1.1.0), which the plugin no longer pins —
expect it only on a desktop/Cowork configuration still held on that version.

1. **Start the trace** with the project, the entry point table, and the wrapped
   input. It returns immediately — the run is asynchronous.
2. **Read the trace nodes once**, without a node id, for the root nodes. It waits
   for the run to finish server-side (no polling, no retrying on 409). Pass the same
   table id if a different process started the trace.
3. Walk down by passing a `nodeId` to get that node's children. Follow the branch
   that leads to the reported problem — the failing calculation, the decision table,
   the factor that came back null — instead of expanding everything.
4. **Read the node details** of the interesting node for its parameters,
   runtime context, result, and error. **Reading a trace parameter** resolves a
   parameter whose value arrived lazy (`lazy: true` with a `parameterId`).
5. Ask for exact values when the numbers matter: `showRealNumbers: true` keeps full
   precision, and `response_format: "json"` avoids a prettified summary.
6. **Cancel the trace** to abort a run that is taking too long.

Node details are the default way to read values. **Exporting the trace** dumps the **whole**
run as plain text — every parameter, runtime context, and result along the way, which for
a policy or claim payload means personal data and the full business logic. Do not export
to "have the trace handy", and never hand the dump to the user as a shareable artifact on
your own initiative: ask for the specific node instead. Export only when the user asks
for a complete trace, say what it contains before producing it, quote just the lines that
carry the evidence, and use `release: true` so the trace does not sit in server memory.

## Path B — interactive debugger (step and watch cells are available)

This is the connection version this plugin pins (`openl-mcp` 1.2.0), which replaced the
tree trace with a debugger. Prefer it whenever it is there.

1. Start with a whole-run profiling pass: **start the trace** with
   `stopAtEntry: false`, `profiling: true` and an explicit `breakpoints: []`. The
   breakpoint set is only replaced when you send one, so omitting it keeps the previous
   session's breakpoints and the "single call" run stops somewhere unexpected. The run
   returns a constant-size `profile` — `hotspots` (slowest tables by
   selfMillis/totalMillis/count) plus `nodeCount`/`distinctTables`/`totalMillis`. Add
   `includeTree: true` to browse structure, and walk deeper levels by
   **expanding the trace tree**.
2. Scan `profile.hotspots` for the table relevant to the problem — the hot table, or
   one that ran an unexpected number of times. Treat this as a **sample, not an
   inventory**: `hotspots` ranks by time and holds only the top N (backend default 20,
   raise it with `profileTop`), so a fast table that returns a wrong value may not
   appear at all. If the table you suspect from Phase 1 is missing, go to it directly
   with a watch or a breakpoint instead of concluding it is innocent — and check
   `profile.truncated` and a node's `notRetained`, which mark a tree the server cut at
   its size limit.
3. **Watching trace cells** returns one series per named cell across the whole run,
   so a single call shows a factor's value in every coverage/iteration. Find the
   outlier (e.g. `83.372` among `1.0`s). Compare each series' length with the `total`
   execution count it reports: the server caps points per series, so a shorter series
   means later executions are not in front of you — narrow the run or break into the
   later instances before calling a factor clean.
4. Replay into the offending pass: restart with a breakpoint built from the outlier's
   `ref` and `instance` — `<ref>@<instance>`, where `@N` targets the N-th execution
   (a plain cell breakpoint stops on every pass). Send neither input nor test ranges
   on the replay; the previous run's input is remembered.
5. **Inspect the suspended frame**: parameters, runtime
   context, computed step values, and — for a decision table — which rule fired and
   how each condition evaluated. `excludeStepValues: [1]` hides neutral rating
   factors (lazy values are resolved before the comparison, so lazily-arriving
   neutral factors are filtered too). **Reading a trace value** expands a lazy value.
6. **Stepping** with `type: "out"` runs the current frame to its own exit so
   its result is inspectable — the main step for declarative rules;
   `"into"`/`"over"` are for imperative TBasic and loops. **Resuming** runs
   to the next breakpoint, exception, or completion.
7. **Stop the trace** when the investigation is done.

## When a trace won't start

- **404** — read the message the backend returned before deciding. The usual cause is a
  stale project session: open the project and retry once. It can also mean an id that no
  longer resolves (table ids change when an edit relocates a table), a project that is
  not in the list at all, or a Studio without that trace endpoint. Re-list the projects
  and tables to re-resolve both ids, and retry with the fresh ones.
- **Still failing after opening the project and re-resolving the ids** — stop, report the
  exact error message and which of the causes above you ruled out, and suggest filing a
  bug against the OpenL Studio connection (`openl-mcp`).
- Whatever the cause: do NOT quietly fall back to reading tables by hand and presenting
  that as a trace result. Say the trace could not run.
- **The run ends in `error`** — the failing frame carries a structured error with the
  table, step, and exception. That is usually the root-cause pointer.
