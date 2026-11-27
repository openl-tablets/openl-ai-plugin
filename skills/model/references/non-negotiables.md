# Non-negotiables in full

Part of the model skill, moved word for word from its SKILL.md. Workflow and the one-line Non-negotiables are in [SKILL.md](../SKILL.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

SKILL.md keeps each rule as a one-line statement; this file holds the full rule with its examples and edge cases. Read the section a SKILL.md rule links to before applying it, and the whole file before a review or a first build.

## Contents

- [Non-negotiable 1: names and types](#non-negotiable-1-names-and-types)
- [Non-negotiable 2: a field lives on its owner](#non-negotiable-2-a-field-lives-on-its-owner)
- [Non-negotiable 3: closed lists are vocabularies](#non-negotiable-3-closed-lists-are-vocabularies)
- [Non-negotiable 4: no parameter is guessed](#non-negotiable-4-no-parameter-is-guessed)
- [Non-negotiable 5: dependencies before any change](#non-negotiable-5-dependencies-before-any-change)
- [Non-negotiable 6: no contract change without approval](#non-negotiable-6-no-contract-change-without-approval)
- [Non-negotiable 7: fixed place for datatypes and vocabularies](#non-negotiable-7-fixed-place-for-datatypes-and-vocabularies)
- [Non-negotiable 8: every major object has an identifier](#non-negotiable-8-every-major-object-has-an-identifier)
- [Non-negotiable 9: one attribute, one unit, one meaning](#non-negotiable-9-one-attribute-one-unit-one-meaning)
- [Non-negotiable 10: only what the consumer sends or receives](#non-negotiable-10-only-what-the-consumer-sends-or-receives)
- [Non-negotiable 11: never flatten the hierarchy](#non-negotiable-11-never-flatten-the-hierarchy)

## Non-negotiable 1: names and types

**Names and types follow the model's existing conventions.** A new datatype, field or vocabulary follows its siblings (and AGENTS.md): casing, singular or plural, array naming, how units and identifiers are named, which sheet it goes on. A new project has no convention yet: propose this default and get the user's confirmation before writing.
- Datatypes and vocabularies: singular business nouns in PascalCase (`Claim`, `BenefitType`). Fields: camelCase.
- An array field has the singular type and a plural name (`ClaimLine[] claimLines`, `Loss[] losses`).
- Every field name says what it holds when read alone in a rule. A generic word (type, amount, date, number, code, status, name, rate, factor) is qualified with its business noun (`driverType`, `lossType`, `lossAmount`, `lossDate`, `claimNumber`), never bare `type` or `amount`: a model holds many types and amounts, and a rule must show which one it reads.
- No abbreviation the business does not use.

## Non-negotiable 2: a field lives on its owner

**A field lives on the object that owns it.** Add a field where its owner is in the hierarchy, once. Never copy a parent's field onto a child, or a child's onto the parent, for convenience in a formula: the rules read it through the path.
- The model mirrors the consumer's object structure, level for level, even where no calculation happens on a level. Every datatype except the top one is reachable as a field of its parent.
- **Group related attributes into their own datatype.** Four or more attributes of one object that describe one business thing go in a datatype of their own, even if the product model has no such entity (a commission: format, flat percent, heaped schedule). Attach it at the level where the product model holds those attributes (`Policy.commission : Commission`), so the hierarchy still matches level for level. A grouping datatype sent only when it applies replaces its "applied" flag (absent = not applied).

## Non-negotiable 3: closed lists are vocabularies

**Closed value lists are vocabularies, never free strings.** Check every input for a closed list before giving it a plain type.
- A fixed set of values in the requirement (limits, periods, tiers, plans, bands with labels) makes the field an alias datatype (vocabulary) candidate, even when the values look like numbers. A value shown with its unit or label keeps it (a period of 1, 2 or 3 years is a String vocabulary that names the unit, not Integer 1 / 2 / 3 with the unit dropped). A field whose values come from a fixed list gets a vocabulary.
- **Vocabulary values never contain blanks, brackets or punctuation**.
- Where the values come from decides how they are written:

  | Owner of the list | How values are written |
  |---|---|
  | Another system (e.g. the policy system's lookup values it sends in the request) | Copied as that system codes it (spelling and case), **except: a technical prefix repeated on every value with no business meaning is dropped, and so is a type suffix the vocabulary's name already says** (`SRC_AccidentalDeathBenefit` in a `BenefitName` vocabulary → `AccidentalDeath`). Business words stay. The dropped prefix and suffix go on the integration mapping hand-off: the policy side must strip them when it maps the codes. The requirement's display text is not the code: ask for the codes when only labels are given. |
  | No other system (values first defined in this model) | Non-negotiable 1. |

- The requirements don't say which lists are which → ask.
- One vocabulary per list, reused by every field that takes that list. Yes/no is `Boolean`. Never add a value nobody named.

## Non-negotiable 4: no parameter is guessed

**No parameter is guessed.** Every input traces to the requirements inventory and to what the consumer sends. Anything not settled (type, unit, cardinality, required or optional, default, allowed values, source field) goes on the clarification list for the BA. It is not written as a guess, and not worked around by reusing another field or hard-coding a value.

## Non-negotiable 5: dependencies before any change

**Dependencies before any change.** A field, datatype or vocabulary value can be read by rules in this project and in projects that depend on it, test and data tables, a UI config, the exposed service and its consumers, and integration mappings.
- Before renaming, retyping, moving or removing anything, and before adding or removing a vocabulary value, run a dependency check: a dependency-analysis tool if available; otherwise search the whole project, its dependent projects and the UI config for the name, and read the test tables and the entry point's schema.
- List what breaks. Hand off whatever lies outside the project. Never change something whose readers you have not checked.

## Non-negotiable 6: no contract change without approval

**No contract change without approval.** Any change to the request is a contract change: a new, renamed, removed or retyped field; a changed cardinality or required-ness; changed vocabulary values. Stop before the project is saved: the consuming team verifies the change and the user approves it. The user decides when the branch is saved, merged and deployed.

## Non-negotiable 7: fixed place for datatypes and vocabularies

**Datatypes and vocabularies have a fixed place:** the project's model module (the module that holds its datatypes).
- All datatypes on one sheet named Model, top-down from the entry point's main input (for example `Policy`): each object above the objects it contains, so the sheet reads like the request.
- Vocabularies on a separate sheet named Vocabulary, in the order their fields appear on the Model sheet. Exception: the longest list goes to the bottom (several long lists keep their field order among themselves), so the short ones stay in view without scrolling.
- A new table goes where this order puts it. An existing project laid out differently keeps its layout, and its new tables follow that layout, unless the user asks to reorganise it.

## Non-negotiable 8: every major object has an identifier

**Every major object has an identifier.** An object is major when the consumer sends it and calculations, configurations or results happen on its level and go back to the app (the response echoes the identifier): a policy, a plan, a coverage.
- Every major object carries the field that identifies it, the top datatype included (`policyID` on `Policy`, `vehicleID` on `Vehicle`, `planName` on `Plan`).
- No project convention → `<object>ID` with `ID` in capitals, the same on every level. A policy number the consumer sends as the identifier is still `policyID` unless the user says otherwise.
- An item generalised into an array is identified by its name vocabulary (`benefitName`).
- The requirements name no identifier → propose one and put its source field on the clarification list. Never leave the top level, or any level that can repeat, without one.

## Non-negotiable 9: one attribute, one unit, one meaning

**One attribute, one unit, one meaning.**
- Never let an attribute hold a dollar amount for some values and a percent for others (an expense whose type decides whether `expenseAmount` is $2,000 or 2%). Give each unit its own attribute, named with it (`expenseAmount`, `expensePercent`), and say in the description which types use which.
- Same for meaning. A generic pair or slot in the source whose meaning depends on another value (a source with `value1` / `value2` slots whose meaning depends on the option type: closed / open for a dislocation, second / third degree for a burn) → one field per meaning, named for it (`closedReductionAmount`, `openReductionAmount`, `secondDegreeBurnAmount`, `thirdDegreeBurnAmount`), unless the product model or the user specifically requests the combined field.
- Never a combined name such as `closedOrSecondDegreeAmount`; "Or" in a name is the sign. The routing (which source slot feeds which field, for which values) goes on the integration mapping hand-off.

## Non-negotiable 10: only what the consumer sends or receives

**The model holds only what the consumer sends or receives:** the datatypes the consumer sends (and, in a project whose response is an output datatype, that datatype), and their vocabularies. Never add a helper structure the rules use internally (a rating-grid row, a pair of weights, a two-value lookup result); use a lookup returning one value per key, a vocabulary or a spreadsheet result instead. Two exceptions: a helper datatype already in the project stays as it is (never removed or replaced on this rule's account), and one is added when the user specifically asks for it.

## Non-negotiable 11: never flatten the hierarchy

**Never flatten the hierarchy; no structural choice without asking.** The levels, objects, cardinalities and owners come from the consumer's structure (product model, product configuration, mapping), or, when the user confirmed there is none, from the reference implementation the user named, taken in full.
 - Never drop, merge, flatten, skip or re-parent a level or object; never turn an array level into a single object; never move a group of fields to another level — for any reason.
 - Reasons that do not count: the requirements do not mention the level; no rule calculates on it; its usual data source is excluded; the model looks simpler; it is only a draft.
 - Any such change is a question asked in the conversation before the draft, with what it breaks (identifiers, response levels, matching in dependent flows, the mapping). Until the user answers, the full structure is drafted.
 - Before showing a draft, run the level check: the source's levels next to the draft's, identical.
