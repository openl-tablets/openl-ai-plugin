# Row-Chain Normalization

This procedure belongs only to logging. Before writing the data artifact, derive each semantic key from `keyFields` and the applicable complete row state, group row mutations by complete target selector and that derived key, preserve their observed sequence, and reduce each group to its net mutation. Records within a multi-record operation participate independently.

Apply a reduction only when adjacent snapshots join exactly: an earlier `after` or added state must equal the next mutation's required prior state. A broken chain returns `FAIL` with `NON_CONTIGUOUS_ROW_HISTORY`; never guess an intermediate state.

| Observed chain | Logged result |
|---|---|
| `add A`, then `edit A → B` | One `add` containing final state `B` |
| `add A`, then `remove A` | Omit as a net no-op |
| `edit A → B`, then `edit B → C` | One `edit A → C` |
| `edit A → B`, then `remove B` | One `remove` containing original state `A` |
| `remove A`, then `add B` with the same unchanged key | One `edit A → B`; omit if `A` and `B` are equal |

A key-changing edit remains an ordered remove under the old key followed by an add under the new key. Do not combine mutations with different target sets or keys.

After normalization, each data artifact must contain at most one effective row mutation for a complete target selector and derived semantic key. If overlapping multi-target operations prevent an unambiguous reduction, split them into single-target operations or return `FAIL` with `AMBIGUOUS_ROW_CHAIN`.
