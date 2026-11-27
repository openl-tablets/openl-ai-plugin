# The response and breaking-change rules

Part of the model skill, moved word for word from its SKILL.md. The Workflow, the hand-offs and Writing the table are in [SKILL.md](../SKILL.md); the full Non-negotiables are in [non-negotiables.md](non-negotiables.md); Scope and sources, the Workflow steps in detail and the Verification checklist are in [sources-workflow-verification.md](sources-workflow-verification.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

## The response

This skill builds the input model; the response is not built here. What the entry point returns is built in the Spreadsheet tables, and the spreadsheet skill owns it: which values go back at which level, the output markers, the identifiers of every repeating level, rounding, response size and the consumer's review of a response change. This skill gives it the identifiers the request carries (Non-negotiable 8), so the response can echo them.

- A project that returns output datatypes instead of marked steps keeps them. The spreadsheet skill decides their content; the datatype tables themselves are written here, under the naming and layout rules (Non-negotiables 1 and 7), only when asked.
- A model change the response must follow (a renamed identifier that is echoed back, a removed field that was returned) goes to the spreadsheet skill in the hand-off.

## Breaking-change rules

Every change to the request is a contract change and goes through approval (Non-negotiable 6). Whether it is breaking decides what else it needs.

- **Breaking:** renaming a field or datatype; removing a field, a datatype or a vocabulary value; respelling a vocabulary value; retyping a field (including a free string becoming a vocabulary, or a change of number or date type); single ↔ array; optional → required; removing or changing a default the consumer relies on; moving a field to another object (its path changes); changing the entry point's signature.
- **Additive:** a new optional field; a new datatype under an existing level; a new vocabulary value. Additive is not free: a new vocabulary value needs a decision in every table that lists the vocabulary.
- **A breaking change needs:** the dependency check, a hand-off for every reader outside this skill, and a decision by the user on the path. Either a coordinated switch with the consumer's release, or additive first: add the new field, keep the old one until the consumer has moved, remove it later as its own change. The model itself is never versioned; when the rules reading a change must apply it only from a date or to some states or products, those rules go to the versioning skill.
- **Internal datatypes** that are not reachable from the exposed entry point are not part of the contract. They still get the dependency check.
