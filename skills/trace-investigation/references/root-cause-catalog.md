# Root-cause catalog by issue type

Read from `SKILL.md` → Phase 3: open the section for the issue
type identified in Phase 0, analyse the trace with it, then classify the
result with the root cause taxonomy in SKILL.md.

## Contents

- [Error or exception](#issue-error-or-exception)
- [Null or blank result](#issue-null-or-blank-result)
- [Wrong calculation](#issue-wrong-calculation)
- [Technically correct but not the intended scenario](#issue-result-is-technically-correct-but-doesnt-match-the-intended-scenario)
- [Wrong decision or rule match](#issue-wrong-decision-or-rule-match)
- [Cross-project dependency](#cross-project-dependency)
- [Fixing an upstream mapping defect](#fixing-an-upstream-mapping-defect)

## Issue: error or exception

An exception surfaces at the throwing frame before it propagates — read that frame's
parameters and step values right there; the structured `error` names the failing
table, step, and exception type. Read the actual table formula directly from the
project — **never infer it**.

## Issue: null or blank result

Null can be a legitimate result (a rule row intentionally returns null, or no
row matched). Do not assume null is always a bug.

- Find where in the trace the value first became null.
- Read the formula or decision table that produced it.
- Read the **full** relevant lookup table to check whether the input combination
  has a matching row — do not assume it is missing.
- Determine: is null expected (no match by design) or unexpected (missing data,
  wrong routing, missing rule row)?

## Issue: wrong calculation

- Find the cell or rule that produced the unexpected value.
- Read its formula.
- Trace back through inputs — identify which factor, rate, or condition
  contributed the wrong value.
- Read the relevant lookup tables to confirm what was returned and why.

## Issue: result is technically correct but doesn't match the intended scenario

The trace runs cleanly, the formula picks a valid branch, and the math is
internally consistent — yet the result is wrong because the input JSON does
not faithfully represent what was entered on the upstream UI. Suspect this
when:

- The result is off by an order of magnitude (10×, 100×, 1/10×, 1/100×).
- A regression mismatch is segment-specific (e.g. child rate wrong, adult
  rate fine), pointing to one branch of the formula firing on bad input.
- The JSON contains fields that look contradictory, redundant, or impossible
  given what the user describes entering on the UI.

Before concluding "OpenL bug", scan the input JSON for **integrity smells**:

- **Dual-encoded fields** — the same business concept sent two ways at once
  (e.g. both `benefitAmount` and `benefitPercentage` for one benefit). The
  formula's branch-selector silently picks one; if that branch was never
  the user's intent, the result is mathematically correct but conceptually
  wrong.
- **Scale errors** — a percentage arriving as `10` when the formula expects
  `0.1`; a basis-point field arriving as a decimal. Multiply the suspect
  field by the obvious scale factor and check whether the wrong answer
  matches the expected one.
- **Phantom fields** — values present in JSON for inputs the user says they
  never entered. Usually from default values, stale offer config, or a
  mapping layer that always emits the field.
- **Inverted booleans or mis-mapped enums** — `true` where `false` was
  intended, or an enum value that routes to the wrong branch.
- **Effective-date drift** — the JSON's effective date routes the trace to
  a module revision the user did not expect.

Then confirm the **arithmetic identity** from the trace: which branch fired,
what value it used, which constant or sub-formula it applied. If the wrong
result equals what a different input value would have produced via a
different branch, that is the smoking gun (e.g. `100/250 = 0.4` is identical
to what `benefitPercentage = 0.10` would yield via `0.10 × 1000 / 250`).

To confirm the upstream defect, request from the user any of:

- UI screenshot of the field(s) in question
- Product model definition (which fields exist, whether mutually exclusive)
- Offer configuration (defaults, hidden fields, conditional show/hide rules)
- Mapping layer rules that build this part of the JSON

If these aren't provided, do not block — state mapping is the suspected
layer based on the JSON evidence and the arithmetic identity, and request
the artifacts to confirm.

## Issue: wrong decision or rule match

- Find the decision table node in the trace.
- Check which condition matched and which rule was returned.
- Read the full decision table to understand all conditions.
- Determine whether the wrong row fired or the right row is missing.

## Cross-project dependency

When a failing table calls into a shared library or another project:

1. Note the dependency reference in the table formula.
2. Locate the dependency project from the list of available projects.
3. Repeat Phase 3 in the dependency project.
4. Report root cause at the dependency level, not the caller level.

Rating or processing projects often depend on shared library projects. The
failure appears in the calling project but the missing data or rule is in the
shared library.

## Fixing an upstream mapping defect

If the root cause is `UPSTREAM MAPPING DEFECT`, the fix has two sides:

- **Primary** — the caller (UI, integration layer, or mapping rules) must
  stop sending data that misrepresents the UI entry. This is where the bug
  actually lives.
- **Defensive (optional)** — the OpenL formula can be hardened to reject
  contradictory inputs (e.g. reject when both `$` and `%` are non-zero for
  the same benefit) or to document which branch wins. This is a guardrail,
  not the fix.

Name the owning team(s) for each side. Do not draft tickets unless asked —
just state ownership and the nature of each fix clearly.
