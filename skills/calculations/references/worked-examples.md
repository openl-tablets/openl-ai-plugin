# Worked examples

The patterns apply in any domain.

## Example 1 — a new table of common logic, before and after review

Before (as generated, rejected):

```
Spreadsheet SpreadsheetResult DetermineCoverageConstants(Coverage coverage)
Steps                    | Value
AmountType               | = coverage.benefitTerms.amountType
MinAmount : Double       | = $AmountType == "Fixed" ? coverage.benefitTerms.fixedAmount : $AmountType == "Tiered" ? min (coverage.benefitTerms.tieredAmounts) : coverage.benefitTerms.minimumAmount
RoundingRule             | = coverage.benefitTerms.roundingRule
RoundTo                  | = $RoundingRule == "None" or $RoundingRule == null ? 0 : RoundingStep (coverage.benefitTerms.roundingRule).$Increment
ReductionScheduleDesc    | = coverage.benefitTerms.reductionSchedule [order decreasing by reductionAge]
CumulativeReduction      | = coverage.coverageType == "OptionalLife" ? CalculateReduction (coverage.benefitTerms.reductionSchedule [order increasing by reductionAge], length (coverage.benefitTerms.reductionSchedule), 0, null, null) [order decreasing by $Age]
```

After (accepted) — five changes: the siblings' `Step | Formula` headers; no `: Double`; `coverage.` dropped because `coverage` is the only input; the identifier `CoverageType` added as the first step and referenced where the coverage type was re-read; and reuse — `RoundTo` reads `$RoundingRule`, and the schedule is fetched once into the hidden helper `ReductionSchedule~` that the next two steps read instead of re-fetching the attribute:

```
Spreadsheet SpreadsheetResult DetermineCoverageConstants (Coverage coverage)
Step                     | Formula
CoverageType             | = coverageType
AmountType               | = benefitTerms.amountType
MinAmount                | = $AmountType == "Fixed" ? benefitTerms.fixedAmount : $AmountType == "Tiered" ? min (benefitTerms.tieredAmounts) : benefitTerms.minimumAmount
RoundingRule             | = benefitTerms.roundingRule
RoundTo                  | = $RoundingRule == "None" or $RoundingRule == null ? 0 : RoundingStep ($RoundingRule).$Increment
ReductionSchedule~       | = benefitTerms.reductionSchedule
ReductionScheduleDesc    | = $ReductionSchedule [order decreasing by reductionAge]
CumulativeReduction      | = $CoverageType == "OptionalLife" ? CalculateReduction ($ReductionSchedule [order increasing by reductionAge], length ($ReductionSchedule), 0, null, null) [order decreasing by $Age]
```

## Example 2 — split a large array once instead of filtering it per element (rule 6)

Before: every class-level run filters the whole census again, once per class × age × gender.

```text
Spreadsheet SpreadsheetResult DetermineClassRate (Class class, Employee[] census, Integer age, Gender gender)
Step                     | Formula
ClassNumber              | = classNumber
FilteredCensus           | = census [select all having classNumber == $ClassNumber and age == age and gender == gender]
NumberOfLives            | = length ($FilteredCensus)
```

After: the top level splits the census once; each lower level receives its own group and only picks from it.

```
Spreadsheet SpreadsheetResult DeterminePolicyPremium (Policy policy)
Step                     | Formula
CensusByClass            | = census [split by classNumber]
ClassCensus              | = ClassCensusCalculation ($CensusByClass)              ← one run per class group

Spreadsheet SpreadsheetResult ClassCensusCalculation (Employee[] census)
Step                     | Formula
ClassNumber              | = census[0].classNumber
ByAgeGender              | = census [split by age + "_" + gender]
AgeGenderGroups          | = AgeGenderCensusCalculation ($ByAgeGender)             ← one run per age/gender group

Spreadsheet SpreadsheetResult AgeGenderCensusCalculation (Employee[] census)
Step                     | Formula
Age                      | = census[0].age
Gender                   | = census[0].gender
NumberOfLives            | = length (census)

Spreadsheet SpreadsheetResult DetermineClassRate (SpreadsheetResultClassCensusCalculation classCensus, Integer age, Gender gender)
Step                     | Formula
Group                    | = classCensus.$AgeGenderGroups [select first having $Age == age and $Gender == gender]
NumberOfLives            | = $Group.$NumberOfLives
```

The census is read once per class instead of once per class × age × gender, and the lower table does a `select first` on a few groups instead of a `select all` over thousands of records.
