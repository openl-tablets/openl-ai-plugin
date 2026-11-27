#!/usr/bin/env python3
"""Convention check for OpenL tables, run before every save.

Input: one JSON file holding the raw tables to check, as the OpenL Studio
connection returns them (RawSource: {"name", "source": [[{"value": ...}]]}).
Put in it every new or changed executable table (decision tables,
spreadsheets) and the Datatype and vocabulary tables their inputs use.
Accepted shapes: a list of tables, {"tables": [...]}, or {"data": table}.
Signature-only entries ({"name", "signature"} as a table listing returns
them) may be added for the tables the formulas call, so C3 can read the
called parameter's type.

    python3 check_conventions.py tables.json

Checks (each finding names the table and the cell):
  C1 key-input-duplicated  a parameter repeats a field of another object input
  C2 owner-not-needed      `param.field` where only that input owns `field`
  C3 vocabulary-as-text    a text literal in a formula is a vocabulary value
  C4 array-for-one-cell    an array input is read by a single cell only
  C5 mixed-suffix          tables of one family (called from the same table)
                           end in different suffixes (Weight / Adjustment /
                           Factor ...)
  C6 role-name             a table is named after a mathematical role
                           (Weight, Coefficient, Multiplier, Share); confirm
                           the requirement uses that word

Exit code 0 = no findings, 1 = findings, 2 = bad input.
"""
import json
import re
import sys

EXEC_RE = re.compile(
    r"^\s*(SmartRules|SimpleRules|SmartLookup|SimpleLookup|Rules|Spreadsheet|"
    r"SimpleSpreadsheet|Method|TBasic|Lookup)\s+(\S+)\s+(\w+)\s*\((.*)\)\s*$",
    re.S,
)
DT_RE = re.compile(r"^\s*Datatype\s+(\w+)\s*(<\s*(\w+)\s*>)?\s*$")
PARAM_RE = re.compile(r"^\s*([\w.<>&\s]+?(?:\[\])*)\s+(\w+)\s*$")
QUAL_RE = re.compile(r"(?<![\w$.])([a-z]\w*)\.([a-zA-Z_]\w*)")
LIT_RE = re.compile(r'"([^"\\]*)"')
CALL_RE = re.compile(r"(?<![\w$.])([A-Z]\w*)\s*\(")
SUFFIXES = ["AdjustmentFactor", "Adjustment", "Factor", "Weight",
            "Coefficient", "Multiplier", "Share", "Ratio"]
ROLE_WORDS = ["Weight", "Coefficient", "Multiplier", "Share"]


def load(path):
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    if isinstance(doc, dict) and "tables" in doc:
        doc = doc["tables"]
    elif isinstance(doc, dict) and "data" in doc:
        doc = [doc["data"]]
    elif isinstance(doc, dict):
        doc = [doc]
    out = []
    for t in doc:
        if isinstance(t, dict) and "data" in t and "source" not in t:
            t = t["data"]
        out.append(t)
    return out


def cell_values(row):
    return [c.get("value") for c in row if not c.get("covered")]


def header(table):
    src = table.get("source") or []
    if not src:
        return ""
    vals = cell_values(src[0])
    return str(vals[0]) if vals and vals[0] is not None else ""


def parse_model(tables):
    datatypes, vocabularies = {}, {}
    for t in tables:
        m = DT_RE.match(header(t))
        if not m:
            continue
        name, alias = m.group(1), m.group(3)
        rows = [cell_values(r) for r in t["source"][1:]]
        if alias:
            vocabularies[name] = {str(r[0]).strip() for r in rows
                                  if r and r[0] not in (None, "")}
        else:
            fields = set()
            for r in rows:
                if len(r) >= 2 and r[1] not in (None, ""):
                    if str(r[1]).strip().lower() in ("name", "field name"):
                        continue
                    fields.add(str(r[1]).strip())
            datatypes[name] = fields
    return datatypes, vocabularies


def parse_params(text):
    params, depth, cur = [], 0, ""
    for ch in text:
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth -= 1
        if ch == "," and depth == 0:
            params.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        params.append(cur)
    out = []
    for p in params:
        m = PARAM_RE.match(p)
        if m:
            out.append((m.group(1).strip(), m.group(2)))
    return out


def base_type(t):
    return t.replace("[]", "").strip()


def formulas(table):
    """Yield (cell, text) for every expression cell below the header."""
    for row in table["source"][1:]:
        for c in row:
            v = c.get("value")
            if isinstance(v, str) and v.lstrip().startswith("="):
                yield c.get("cell", "?"), v


def step_names(table):
    names = set()
    for row in table["source"][2:]:
        vals = cell_values(row)
        if vals and isinstance(vals[0], str):
            names.add(vals[0].split(":")[0].strip())
    return names


def literal_args(text):
    """Yield (literal, called table, argument index) for each text literal."""
    stack, i, n = [], 0, len(text)
    while i < n:
        ch = text[i]
        if ch == '"':
            j = text.find('"', i + 1)
            j = n if j < 0 else j
            top = stack[-1] if stack else None
            yield text[i + 1:j], (top[0] if top else None), (top[1] if top else None)
            i = j + 1
            continue
        m = re.match(r"([A-Za-z_]\w*)\s*\(", text[i:])
        if m and (i == 0 or not (text[i - 1].isalnum() or text[i - 1] in "_$.")):
            stack.append([m.group(1), 0])
            i += m.end()
            continue
        if ch == "(":
            stack.append([None, 0])
        elif ch == ")" and stack:
            stack.pop()
        elif ch == "," and stack:
            stack[-1][1] += 1
        i += 1


def suffix_of(name):
    for s in SUFFIXES:
        if name.endswith(s) and len(name) > len(s):
            return s
    return None


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2
    try:
        tables = load(argv[1])
    except (OSError, ValueError) as exc:
        print(f"Cannot read {argv[1]}: {exc}")
        return 2
    datatypes, vocabularies = parse_model(tables)
    vocab_of_value = {}
    for vname, values in vocabularies.items():
        for v in values:
            vocab_of_value.setdefault(v, vname)

    signatures = {}
    for t in tables:
        sig = t.get("signature") if "source" not in t else None
        m = EXEC_RE.match(header(t)) if "source" in t else None
        if m:
            signatures[m.group(3)] = [ty for ty, _ in parse_params(m.group(4))]
        elif sig:
            sm = re.match(r"\s*(\w+)\s*\((.*)\)\s*$", sig, re.S)
            if sm:
                signatures[sm.group(1)] = [ty for ty, _ in parse_params(sm.group(2))]

    findings, calls_by_table, exec_names = [], {}, []
    for t in tables:
        if "source" not in t:
            continue
        m = EXEC_RE.match(header(t))
        if not m:
            continue
        kind, _ret, name, ptext = m.groups()
        exec_names.append(name)
        params = parse_params(ptext)
        pnames = {p for _, p in params}
        ptype = {p: base_type(ty) for ty, p in params}
        steps = step_names(t) if "Spreadsheet" in kind else set()

        # C1: a plain input that repeats a field of an object input
        for ty, p in params:
            for oty, op in params:
                if op == p:
                    continue
                if p in datatypes.get(base_type(oty), set()):
                    findings.append((name, "header", "C1 key-input-duplicated",
                                     f"`{p}` is already `{op}.{p}`; drop the "
                                     f"parameter and read the field (a Smart "
                                     f"condition titled by it matches the field)"))
                    break

        cells = list(formulas(t))
        for cell, text in cells:
            # C2: owner prefix where only one input owns the field
            for obj, field in QUAL_RE.findall(text):
                if obj not in pnames or ptype[obj] not in datatypes:
                    continue
                if field not in datatypes[ptype[obj]]:
                    continue
                owners = [p for p in pnames
                          if field in datatypes.get(ptype[p], set())]
                if len(owners) == 1 and field not in pnames and field not in steps:
                    findings.append((name, cell, "C2 owner-not-needed",
                                     f"write `{field}`, not `{obj}.{field}`: "
                                     f"no other input owns `{field}`"))
            # C3: vocabulary values written as text
            for lit, callee, idx in literal_args(text):
                if lit not in vocab_of_value:
                    continue
                vocab = vocab_of_value[lit]
                types = signatures.get(callee)
                ptyp = base_type(types[idx]) if types and idx is not None and idx < len(types) else None
                if ptyp in vocabularies:
                    continue  # typed by a vocabulary: Studio checks the value
                where = f"`{callee}` argument {idx + 1}" if callee is not None else "the formula"
                state = (f"is typed `{ptyp}`" if ptyp else "has an unknown type (add its signature to the input)")
                findings.append((name, cell, "C3 vocabulary-as-text",
                                 f"\"{lit}\" is a value of `{vocab}`, passed to {where}, which "
                                 f"{state}; type that parameter `{vocab}` so a renamed "
                                 f"value fails to compile"))
            calls_by_table.setdefault(name, set()).update(CALL_RE.findall(text))

        # C4: an array input read by one cell only
        if "Spreadsheet" not in kind:
            for ty, p in params:
                if not ty.endswith("[]"):
                    continue
                used = [c for c, txt in cells
                        if re.search(rf"(?<![\w$.]){p}\b", txt)]
                if len(used) == 1:
                    findings.append((name, used[0], "C4 array-for-one-cell",
                                     f"`{p}` ({ty}) is read only here; let the "
                                     f"caller compute the value this cell needs "
                                     f"and pass that instead"))

    # C5: one family, different suffixes
    for caller, callees in calls_by_table.items():
        fam = {}
        for c in callees:
            s = suffix_of(c)
            if s and s != "Ratio":
                fam.setdefault(s, []).append(c)
        if len(fam) > 1:
            parts = "; ".join(f"{s}: {', '.join(sorted(n))}" for s, n in sorted(fam.items()))
            findings.append((caller, "calls", "C5 mixed-suffix",
                             f"tables of one family use different suffixes ({parts}); "
                             f"use the requirement's term with one suffix"))

    # C6: names after a mathematical role
    seen = set()
    for n in exec_names + sorted(set().union(*calls_by_table.values()) if calls_by_table else []):
        if n in seen:
            continue
        seen.add(n)
        for w in ROLE_WORDS:
            if re.search(rf"{w}(?:[A-Z]|$)", n):
                findings.append((n, "name", "C6 role-name",
                                 f"named after a mathematical role ('{w}'); keep it "
                                 f"only if the requirement calls the value '{w}'"))
                break

    if not findings:
        print(f"No findings in {len(exec_names)} executable table(s).")
        return 0
    print(f"{len(findings)} finding(s) in {len(exec_names)} executable table(s):")
    for table, where, code, msg in findings:
        print(f"- {table} [{where}] {code}: {msg}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
