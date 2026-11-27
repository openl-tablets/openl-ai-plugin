# Worked examples

The decision-table skill's full examples, referenced from its SKILL.md by number. Section names in parentheses (Non-negotiables, Workflow, Writing the table, Verification checklist) are in short form in [SKILL.md](../SKILL.md) and in full in [non-negotiables.md](non-negotiables.md) and [workflow-and-writing.md](workflow-and-writing.md); any other is in a file listed under **Where to read** there.

The patterns apply in any domain. Values are placeholders (`f1`, `f2` …) so that no figure here is taken for a real rate.

**Example 1 — the catch-all row and the gaps (Non-negotiables 3 and 4).** Before (as generated, rejected): the blank row stands first, so it matches every input and the three rows below it never fire.

```text
SmartRules Double RiskFactor (RiskType riskType, Boolean hasSafetyDevice)
Risk Type    | Safety Device | Factor
             |               | f1
Standard     | true          | f2
Standard     | false         | f3
Elevated     |               | f4
```

After (accepted): the catch-all row is gone and the specific rows come first. The vocabulary `RiskType` also holds `High`, which no row named, and the safety-device flag is optional (a `Boolean` has no vocabulary, so empty is part of its domain): a `Standard` risk with no flag matched neither `Standard` row. Both gaps were listed and the user gave their values. Because the risk type is a vocabulary, `High` gets its own row instead of a catch-all, and the table is recorded against `RiskType` so it is revisited when the vocabulary grows (Non-negotiable 3).

```text
SmartRules Double RiskFactor (RiskType riskType, Boolean hasSafetyDevice)
Risk Type    | Safety Device | Factor
Standard     | true          | f2
Standard     | false         | f3
Standard     |               | f1        ← no flag: the value the user gave
Elevated     |               | f4
High         |               | f1        ← the value the user gave
```

**Example 2 — a list of combinations becomes a lookup (Optimizing an existing table).** Before: six rows, one per region and tier.

```text
SmartRules Double RegionTierFactor (Region region, Tier tier)
Region | Tier       | Factor
A      | Individual | f1
A      | Family     | f2
B      | Individual | f3
B      | Family     | f4
C      | Individual | f5
C      | Family     | f6
```

After: the key with two values goes across the top. The name, inputs and return type are unchanged, so no caller changes; the title `Region / Tier` names both keys, so each is matched to its input by name and the table does not depend on parameter order. The domain run returns the same six values as before.

```text
SmartLookup Double RegionTierFactor (Region region, Tier tier)
Region / Tier | Individual | Family
A             | f1         | f2
B             | f3         | f4
C             | f5         | f6
```

**Example 3 — a Double input: one range notation, no gap (Non-negotiable 5).** Before: integer-style bands on a Double input, with two notations in one column. A loss ratio of 0.655 or 0.795 falls in no band.

```text
SmartRules Double ExperienceFactor (Double lossRatio)
Loss Ratio   | Factor
< 0.5        | f1
0.5 - 0.65   | f2
0.66 - 0.79  | f3
[0.8; 1)     | f4
1+           | f5
```

After: every band uses the bracket form, with the lower end included and the upper end excluded, and each band starts where the previous one ends, so no value falls between them. The bounds come from the requirement (below 50%, 50–65%, 65–80%, 80–100%, 100% and above, lower bound included), confirmed with the user before the gaps were closed. With an Integer input, both-ends-included bands such as 25 - 29 and 30 - 34 meet without a gap; with a Double input they never do.

```text
SmartRules Double ExperienceFactor (Double lossRatio)
Loss Ratio   | Factor
< 0.5        | f1
[0.5; 0.65)  | f2
[0.65; 0.8)  | f3
[0.8; 1)     | f4
1+           | f5
```

**Example 4 — a ternary chain becomes a table (Non-negotiable 8).** Before, a spreadsheet step:

```text
PlanFactor   | = planType == "Basic" ? f1 : planType == "Enhanced" ? f2 : planType == "Premier" ? f3 : f4
```

After: the values move into a SmartRules table, and the step (changed with the skill that builds Spreadsheet tables) only calls it. The last value of the chain applied to every other plan type. `PlanType` is a vocabulary, so the user confirmed which values those are, and each gets its own row, as the requirement lists them, instead of a catch-all (Non-negotiables 3 and 9).

```text
SmartRules Double PlanFactor (PlanType planType)
Plan Type         | Factor
Basic             | f1
Enhanced          | f2
Premier           | f3
Standard          | f4
Legacy            | f4

PlanFactor   | = PlanFactor (planType)
```

**Example 5 — a Rules table in its short form, with a key across the top (Non-negotiable 9).** The requirement: a rate per coverage type (two types share one rate, "any other coverage type" has its own), and "for a rented car add a 20% charge on the base rate". The task asks for a Rules table. Before (as generated, rejected): hand-written `contains(coverageTypes, coverageType)` and `rentOrOwn == rentOrOwnValue` expressions with named parameters, a second return parameter holding a charge of 0 or 0.2, every coverage doubled into an Own row and a Rent row, and "any other" written as a list of the four remaining vocabulary values. Ten rows and four columns, where five rows and three columns say the same thing.

After (accepted): the conditions are in short form, so OpenL generates the checks. Rent/Own goes across the top as `HC1`. The charge is a formula in the Rent cells that keeps both given figures visible. "Any other" is one blank row, last.

```text
Rules Double BaseRateR (CoverageType coverageType, RentOrOwn rentOrOwn)
C1                                   | HC1        | RET1
coverageType                         | rentOrOwn  |
CoverageType[]                       | RentOrOwn  |
Coverage Type                        | Own        | Rent
Bodily Injury                        | 150        | =150 * (1 + 0.2)
Property Damage                      | 130        | =130 * (1 + 0.2)
Collision                            | 225        | =225 * (1 + 0.2)
Roadside Assistance, Scheduled Items | 10         | =10 * (1 + 0.2)
                                     | 50         | =50 * (1 + 0.2)
```

**Example 6 — a list of combinations becomes a lookup with two stacked horizontal conditions (Lookup layout).** Before: a SimpleRules table with 30 rows, one per coverage group, experience band and Rent/Own, with the coverage repeated six times and each band twice. A first transformation put only Rent/Own across the top and left 15 rows with the coverage repeated three times (rejected). After: only the coverage goes down the rows. The experience band and Rent/Own both go across the top, the band on the upper row merged over its `Own | Rent` pair. The result is 5 rows × 6 value columns, read at one glance. In a SimpleLookup the horizontal rows follow the signature order (the band is the second parameter, so it is the upper row). The same shape fits a SmartLookup with zip-code ranges across the top (`A100 - A999, A1048` over `Own | Rent`).

```text
SimpleLookup Double BaseRateTransformed (CoverageType coverageType, Integer yearsDrivingExperience, RentOrOwn rentOrOwn)
Coverage Type                        | 0 - 10       | 11 - 40      | 41+
  (merged down over both rows)       | Own  | Rent  | Own  | Rent  | Own  | Rent
Bodily Injury                        | 0.34 | 0.42  | 0.31 | 0.32  | 0.38 | 0.44
Property Damage                      | 0.25 | 0.28  | 0.19 | 0.21  | 0.27 | 0.32
Collision                            | 0.27 | 0.32  | 0.22 | 0.24  | 0.31 | 0.36
Roadside Assistance, Scheduled Items | 0.14 | 0.18  | 0.11 | 0.12  | 0.17 | 0.19
                                     | 0.23 | 0.32  | 0.19 | 0.28  | 0.25 | 0.36
```

**Example 7 — readable keys across the top, coded numbers down the rows or titled (Lookup layout).** A SimpleLookup `Rate (Gender gender, Integer age, WaitingPeriod waitingPeriod, BenefitPeriod benefitPeriod, CoverageType coverageType)` with a long list of rows and only the coverage across the top. A first optimization kept Gender and Age vertical (forced by the SimpleLookup's positional matching) and stacked Waiting Period (0 / 7 / 14), Benefit Period (3 / 6 / 12) and the coverage across the top: a wide table with two rows of bare numbers nobody can name at a glance (rejected). After: a SmartLookup with the same signature, compiled and run in Studio. Waiting Period and Age go down the rows. Gender, Benefit Period and Coverage Type go across the top, titled in the Age column, the last title row reading `Age / Coverage Type`: a compact table, every value unchanged.

```text
SmartLookup Double Rate (Gender gender, Integer age, WaitingPeriod waitingPeriod, BenefitPeriod benefitPeriod, CoverageType coverageType)
Waiting Period | Gender              | Male                                             | Female …
(merged        | Benefit Period      | 3                      | 6         | 12        | 3 …
 down)         | Age / Coverage Type | Accident | Sickness | Injury | …   |           |
0              | 0                   | f1       | f2       | f3     | …
               | 25                  | …
7              | 0                   | …
```

**Example 8 — a dispatcher instead of one merged table (Choosing the table type).** The requirement gives an increased limit factor table per coverage: Bodily Injury by split limit (25 rows), Property Damage by limit (18), Medical Payments by limit (6), Comprehensive and Collision by deductible (9 each). Before (rejected): one `SmartRules Double IncreasedLimitFactor (CoverageType coverageType, Limit limit, Deductible deductible)` with 58 rows, a merged coverage column and a limit and a deductible column that are blank in half of the rows. After, compiled and tested in Studio: a five-row dispatcher and one table per coverage; every value unchanged.

```text
SmartRules Double IncreasedLimitFactor (Coverage coverage)
Coverage Type    | Rule for Increased Limit Factor
BodilyInjury     | = BodilyInjury (limit)
PropertyDamage   | = PropertyDamage (limit)
MedicalPayments  | = MedicalPayments (limit)
Comprehensive    | = Comprehensive (deductible)
Collision        | = Collision (deductible)

SimpleRules Double BodilyInjury (Limit limit)        SimpleRules Double Comprehensive (Deductible deductible)
Limit            | Increased Limit Factor            Deductible | Increased Limit Factor
15000/30000      | f1                                50         | f1
20000/40000      | f2                                100        | f2
…                                                    …
```

The spreadsheet step is `IncreasedLimitFactor = IncreasedLimitFactor (coverage)`. Each per-coverage table sits on its own sheet in the Lookups module.

**Example 9 — separate tables and one routing rule, even when every block has the same conditions (Choosing the table type).** A rate workbook gives a rate block per benefit (Air Ambulance, Emergency Room, Hospital Admission, …). Every block has Male and Female rows and the same age bands across the top. Before (rejected): one merged SmartLookup with the benefit as an extra vertical condition, which cannot be checked block by block against the workbook. After: one SmartLookup per benefit in the workbook's own layout, and a `BenefitRate` routing table with the signature the caller uses; condition cells in the vocabulary spelling, and every rate at the precision the workbook stores, not the three decimals it displays (Non-negotiable 2).

```text
SmartRules Double BenefitRate (BenefitName benefitName, Gender gender, AgeBand ageBand)
Benefit Type          | Rate
AirAmbulance          | = AirAmbulanceRate (gender, ageBand)
EmergencyRoom         | = EmergencyRoomRate (gender, ageBand)
…

SmartLookup Double AirAmbulanceRate (Gender gender, AgeBand ageBand)
Gender | 18-24 | 25-29 | 30-44 | … | 85+
Male   | f1    | f2    | f3    | … | f11
Female | f12   | f13   | f14   | … | f22
```

The caller makes one call, `BenefitRate (benefitName, gender, ageBand)`; each per-benefit table can be compared with its block in the workbook, updated and versioned on its own. The same holds when the blocks differ (Example 8).
